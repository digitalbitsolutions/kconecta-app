<?php

namespace App\Services;

use Illuminate\Http\Request;

class ApiAccessService
{
    private const DEFAULT_MOBILE_TOKEN = "kconecta-dev-token";

    public function __construct(private readonly AuthSessionService $authSessionService)
    {
    }

    public function isAuthorized(Request $request): bool
    {
        if ($request->user() !== null) {
            return true;
        }

        $token = $this->extractBearerToken($request);
        if ($token === null) {
            return false;
        }

        if (hash_equals($this->expectedToken(), $token)) {
            return true;
        }

        return $this->authSessionService->isAccessTokenValid($token);
    }

    public function resolveAccessTokenClaims(Request $request): array
    {
        $token = $this->extractBearerToken($request);
        if ($token === null) {
            return [];
        }

        $claims = $this->authSessionService->resolveAccessTokenClaims($token);
        return is_array($claims) ? $claims : [];
    }

    private function extractBearerToken(Request $request): ?string
    {
        $header = trim((string) $request->header("Authorization", ""));
        if ($header === "") {
            return null;
        }

        if (!preg_match('/^bearer\s+(.+)$/i', $header, $matches)) {
            return null;
        }

        $token = trim((string) ($matches[1] ?? ""));
        return $token !== "" ? $token : null;
    }

    private function expectedToken(): string
    {
        $configured = (string) env("KC_MOBILE_API_TOKEN", self::DEFAULT_MOBILE_TOKEN);
        $normalized = trim($configured);
        return $normalized !== "" ? $normalized : self::DEFAULT_MOBILE_TOKEN;
    }
}
