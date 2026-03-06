<?php

namespace App\Services;

class AuthSessionService
{
    private const DEFAULT_LOGIN_PASSWORD = "kconecta-dev-password";

    public function canLogin(string $password): bool
    {
        $expected = trim((string) env("KC_MOBILE_LOGIN_PASSWORD", self::DEFAULT_LOGIN_PASSWORD));
        $target = $expected !== "" ? $expected : self::DEFAULT_LOGIN_PASSWORD;
        return hash_equals($target, trim($password));
    }

    public function buildLoginPayload(string $email): array
    {
        $role = $this->resolveRoleFromEmail($email);

        return [
            "data" => [
                "access_token" => $this->issueToken("atk", $email),
                "refresh_token" => $this->issueToken("rtk", $email),
                "token_type" => "Bearer",
                "expires_in" => 3600,
                "scope" => $this->scopesForRole($role),
                "role" => $role,
                "issued_at" => now()->toIso8601String(),
            ],
            "meta" => [
                "contract" => "auth-session-v1",
                "mode" => "scaffold",
            ],
        ];
    }

    public function buildRefreshPayload(?string $refreshToken): array
    {
        $normalizedRefresh = trim((string) $refreshToken);
        $nextRefresh = $normalizedRefresh !== ""
            ? $normalizedRefresh
            : $this->issueToken("rtk", "refresh");

        return [
            "data" => [
                "access_token" => $this->issueToken("atk", "refresh"),
                "refresh_token" => $nextRefresh,
                "token_type" => "Bearer",
                "expires_in" => 3600,
                "issued_at" => now()->toIso8601String(),
            ],
            "meta" => [
                "contract" => "auth-session-v1",
                "mode" => "scaffold",
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
                "contract" => "auth-session-v1",
                "mode" => "scaffold",
            ],
        ];
    }

    private function issueToken(string $prefix, string $subject): string
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

    private function scopesForRole(string $role): array
    {
        return match ($role) {
            "admin" => ["admin:*", "properties:*", "providers:*"],
            "provider" => ["providers:read", "providers:write", "jobs:read"],
            default => ["properties:*", "providers:read", "dashboard:read"],
        };
    }
}
