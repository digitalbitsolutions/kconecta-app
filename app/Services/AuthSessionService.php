<?php

namespace App\Services;

use Illuminate\Support\Str;

class AuthSessionService
{
    public const CONTRACT = "auth-session-v1";
    public const MODE = "scaffold";
    public const ERROR_INVALID_CREDENTIALS = "INVALID_CREDENTIALS";
    public const ERROR_TOKEN_INVALID = "TOKEN_INVALID";
    public const ERROR_TOKEN_EXPIRED = "TOKEN_EXPIRED";
    public const ERROR_ROLE_SCOPE_FORBIDDEN = "ROLE_SCOPE_FORBIDDEN";
    public const ERROR_PROVIDER_IDENTITY_MISMATCH = "PROVIDER_IDENTITY_MISMATCH";

    private const DEFAULT_LOGIN_PASSWORD = "kconecta-dev-password";
    private const DEFAULT_ACCESS_TTL_SECONDS = 3600;
    private const DEFAULT_REFRESH_TTL_SECONDS = 86400;
    private const DEFAULT_PROVIDER_ID = 1;

    public function canLogin(string $password): bool
    {
        $expected = trim((string) env("KC_MOBILE_LOGIN_PASSWORD", self::DEFAULT_LOGIN_PASSWORD));
        $target = $expected !== "" ? $expected : self::DEFAULT_LOGIN_PASSWORD;
        return hash_equals($target, trim($password));
    }

    public function buildErrorPayload(
        string $code,
        string $message,
        string $flow,
        string $reason,
        bool $retryable
    ): array {
        return [
            "error" => [
                "code" => $code,
                "message" => $message,
            ],
            "meta" => [
                "contract" => self::CONTRACT,
                "mode" => self::MODE,
                "flow" => $flow,
                "reason" => $reason,
                "retryable" => $retryable,
            ],
        ];
    }

    public function buildLoginPayload(string $email): array
    {
        $normalizedEmail = strtolower(trim($email));
        $role = $this->resolveRoleFromEmail($normalizedEmail);
        $providerId = $this->resolveProviderId($normalizedEmail, $role);

        return $this->buildSessionPayload(
            email: $normalizedEmail,
            role: $role,
            providerId: $providerId,
            refreshTokenOverride: null,
            flow: "login",
            reason: "login_success",
        );
    }

    public function buildRefreshPayloadFromClaims(array $claims): array
    {
        $role = strtolower(trim((string) ($claims["role"] ?? "manager")));
        if (!in_array($role, ["manager", "provider", "admin"], true)) {
            $role = "manager";
        }

        $email = strtolower(trim((string) ($claims["email"] ?? "refresh@kconecta.local")));
        if ($email === "") {
            $email = "refresh@kconecta.local";
        }

        $providerId = null;
        if ($role === "provider") {
            $candidate = $claims["provider_id"] ?? null;
            if (is_numeric($candidate) && (int) $candidate > 0) {
                $providerId = (int) $candidate;
            } else {
                $providerId = $this->resolveProviderId($email, $role);
            }
        }

        return $this->buildSessionPayload(
            email: $email,
            role: $role,
            providerId: $providerId,
            refreshTokenOverride: null,
            flow: "refresh",
            reason: "refresh_success",
        );
    }

    /**
     * Legacy-compatible refresh payload used by bootstrap static-token clients.
     */
    public function buildLegacyRefreshPayload(?string $refreshToken): array
    {
        $normalizedRefresh = trim((string) $refreshToken);
        $nextRefresh = $normalizedRefresh !== ""
            ? $normalizedRefresh
            : $this->issueLegacyToken("rtk", "refresh");
        $email = "refresh@kconecta.local";
        $role = "manager";

        return [
            "data" => [
                "access_token" => $this->issueLegacyToken("atk", "refresh"),
                "refresh_token" => $nextRefresh,
                "token_type" => "Bearer",
                "expires_in" => self::DEFAULT_ACCESS_TTL_SECONDS,
                "issued_at" => gmdate("c"),
                "expires_at" => gmdate("c", time() + self::DEFAULT_ACCESS_TTL_SECONDS),
                "role" => $role,
                "scope" => $this->scopesForRole($role),
                "subject" => $email,
                "email" => $email,
                "display_name" => $this->resolveDisplayName($email, $role, null),
                "provider_id" => null,
            ],
            "meta" => [
                "contract" => self::CONTRACT,
                "mode" => self::MODE,
                "flow" => "refresh",
                "reason" => "refresh_success",
            ],
        ];
    }

    public function buildLogoutPayload(): array
    {
        return [
            "data" => [
                "revoked" => true,
                "revoked_at" => now()->toIso8601String(),
            ],
            "meta" => [
                "contract" => self::CONTRACT,
                "mode" => self::MODE,
                "flow" => "logout",
                "reason" => "logout_success",
            ],
        ];
    }

    public function isAccessTokenValid(string $token): bool
    {
        $validation = $this->validateToken($token, "access");
        return (bool) ($validation["valid"] ?? false);
    }

    public function resolveAccessTokenClaims(string $token): ?array
    {
        $validation = $this->validateToken($token, "access");
        if (!(bool) ($validation["valid"] ?? false)) {
            return null;
        }

        $payload = $validation["payload"] ?? null;
        return is_array($payload) ? $payload : null;
    }

    /**
     * @return array{valid:bool,expired:bool,payload:array<string,mixed>|null,error_code:string|null}
     */
    public function validateToken(string $token, string $expectedType = "access"): array
    {
        $normalized = trim($token);
        if ($normalized === "") {
            return $this->invalidTokenResult(false);
        }

        $parts = explode(".", $normalized);
        if (count($parts) !== 3) {
            return $this->invalidTokenResult(false);
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
        $message = $encodedHeader . "." . $encodedPayload;
        $expectedSignature = $this->sign($message);

        if (!hash_equals($expectedSignature, $encodedSignature)) {
            return $this->invalidTokenResult(false);
        }

        $payload = $this->decodeSegment($encodedPayload);
        if (!is_array($payload)) {
            return $this->invalidTokenResult(false);
        }

        $type = strtolower(trim((string) ($payload["type"] ?? "")));
        if ($expectedType !== "" && $type !== strtolower($expectedType)) {
            return $this->invalidTokenResult(false);
        }

        $exp = (int) ($payload["exp"] ?? 0);
        if ($exp <= 0) {
            return $this->invalidTokenResult(false);
        }

        if (time() >= $exp) {
            return [
                "valid" => false,
                "expired" => true,
                "payload" => $payload,
                "error_code" => self::ERROR_TOKEN_EXPIRED,
            ];
        }

        return [
            "valid" => true,
            "expired" => false,
            "payload" => $payload,
            "error_code" => null,
        ];
    }

    private function invalidTokenResult(bool $expired): array
    {
        return [
            "valid" => false,
            "expired" => $expired,
            "payload" => null,
            "error_code" => $expired ? self::ERROR_TOKEN_EXPIRED : self::ERROR_TOKEN_INVALID,
        ];
    }

    private function buildSessionPayload(
        string $email,
        string $role,
        ?int $providerId,
        ?string $refreshTokenOverride,
        string $flow,
        string $reason
    ): array {
        $issuedAt = time();
        $accessTtl = (int) env("KC_AUTH_ACCESS_TTL", self::DEFAULT_ACCESS_TTL_SECONDS);
        if ($accessTtl < 300) {
            $accessTtl = self::DEFAULT_ACCESS_TTL_SECONDS;
        }

        $refreshTtl = (int) env("KC_AUTH_REFRESH_TTL", self::DEFAULT_REFRESH_TTL_SECONDS);
        if ($refreshTtl < 600) {
            $refreshTtl = self::DEFAULT_REFRESH_TTL_SECONDS;
        }

        $accessExp = $issuedAt + $accessTtl;
        $refreshExp = $issuedAt + $refreshTtl;

        $baseClaims = [
            "email" => $email,
            "role" => $role,
            "provider_id" => $providerId,
        ];

        $accessToken = $this->issueSignedToken(
            type: "access",
            claims: $baseClaims,
            issuedAt: $issuedAt,
            expiresAt: $accessExp,
        );

        $refreshToken = $refreshTokenOverride && trim($refreshTokenOverride) !== ""
            ? trim($refreshTokenOverride)
            : $this->issueSignedToken(
                type: "refresh",
                claims: $baseClaims,
                issuedAt: $issuedAt,
                expiresAt: $refreshExp,
            );

        return [
            "data" => [
                "access_token" => $accessToken,
                "refresh_token" => $refreshToken,
                "token_type" => "Bearer",
                "expires_in" => $accessTtl,
                "expires_at" => gmdate("c", $accessExp),
                "scope" => $this->scopesForRole($role),
                "subject" => $email,
                "email" => $email,
                "display_name" => $this->resolveDisplayName($email, $role, $providerId),
                "role" => $role,
                "provider_id" => $providerId,
                "issued_at" => gmdate("c", $issuedAt),
            ],
            "meta" => [
                "contract" => self::CONTRACT,
                "mode" => self::MODE,
                "flow" => $flow,
                "reason" => $reason,
            ],
        ];
    }

    private function issueSignedToken(string $type, array $claims, int $issuedAt, int $expiresAt): string
    {
        $header = [
            "alg" => "HS256",
            "typ" => "JWT",
            "kid" => "kc-auth-v1",
        ];

        $payload = [
            "iss" => "kconecta-app",
            "aud" => "kconecta-mobile",
            "type" => $type,
            "iat" => $issuedAt,
            "exp" => $expiresAt,
            "jti" => Str::uuid()->toString(),
            "email" => $claims["email"] ?? null,
            "role" => $claims["role"] ?? null,
            "provider_id" => $claims["provider_id"] ?? null,
        ];

        $encodedHeader = $this->encodeSegment($header);
        $encodedPayload = $this->encodeSegment($payload);
        $signature = $this->sign($encodedHeader . "." . $encodedPayload);

        return $encodedHeader . "." . $encodedPayload . "." . $signature;
    }

    private function sign(string $message): string
    {
        $raw = hash_hmac("sha256", $message, $this->tokenSecret(), true);
        return $this->base64UrlEncode($raw);
    }

    private function tokenSecret(): string
    {
        $configured = trim((string) env("KC_AUTH_TOKEN_SECRET", ""));
        if ($configured !== "") {
            return $configured;
        }

        $appKey = (string) config("app.key", "");
        if (str_starts_with($appKey, "base64:")) {
            $decoded = base64_decode(substr($appKey, 7), true);
            if (is_string($decoded) && $decoded !== "") {
                return $decoded;
            }
        }

        if ($appKey !== "") {
            return $appKey;
        }

        return "kconecta-auth-dev-secret";
    }

    private function encodeSegment(array $value): string
    {
        return $this->base64UrlEncode((string) json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    private function decodeSegment(string $encoded): ?array
    {
        $decoded = $this->base64UrlDecode($encoded);
        if ($decoded === null) {
            return null;
        }

        $payload = json_decode($decoded, true);
        return is_array($payload) ? $payload : null;
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), "+/", "-_"), "=");
    }

    private function base64UrlDecode(string $value): ?string
    {
        $normalized = strtr($value, "-_", "+/");
        $padding = strlen($normalized) % 4;
        if ($padding > 0) {
            $normalized .= str_repeat("=", 4 - $padding);
        }

        $decoded = base64_decode($normalized, true);
        return is_string($decoded) ? $decoded : null;
    }

    private function issueLegacyToken(string $prefix, string $subject): string
    {
        $digest = hash("sha256", $subject . "|" . (string) microtime(true));
        return sprintf("%s_%s", $prefix, $digest);
    }

    private function resolveRoleFromEmail(string $email): string
    {
        $normalized = strtolower(trim($email));

        if (str_ends_with($normalized, "@admin.local")) {
            return "admin";
        }
        if (str_ends_with($normalized, "@provider.local")) {
            return "provider";
        }

        return "manager";
    }

    private function resolveProviderId(string $email, string $role): ?int
    {
        if ($role !== "provider") {
            return null;
        }

        $localPart = strstr($email, "@", true);
        $localPart = $localPart !== false ? $localPart : $email;

        if (preg_match('/(\d+)/', $localPart, $matches) === 1) {
            $candidate = (int) ($matches[1] ?? 0);
            if ($candidate > 0) {
                return $candidate;
            }
        }

        $configured = (int) env("KC_DEFAULT_PROVIDER_ID", self::DEFAULT_PROVIDER_ID);
        return $configured > 0 ? $configured : self::DEFAULT_PROVIDER_ID;
    }

    public function scopesForRole(string $role): array
    {
        return match ($role) {
            "admin" => ["admin:*", "properties:*", "providers:*"],
            "provider" => ["providers:read", "providers:write", "jobs:read"],
            default => ["properties:*", "providers:read", "dashboard:read"],
        };
    }

    private function resolveDisplayName(string $email, string $role, ?int $providerId): string
    {
        return match ($role) {
            "admin" => "Admin",
            "provider" => $providerId ? sprintf("Provider #%d", $providerId) : "Provider",
            default => "Manager",
        };
    }
}
