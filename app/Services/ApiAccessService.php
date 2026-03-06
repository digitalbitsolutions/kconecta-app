<?php

namespace App\Services;

use Illuminate\Http\Request;

class ApiAccessService
{
    private const DEFAULT_MOBILE_TOKEN = "kconecta-dev-token";

    public function isAuthorized(Request $request): bool
    {
        if ($request->user() !== null) {
            return true;
        }

        $token = $this->extractBearerToken($request);
        if ($token === null) {
            return false;
        }

        return hash_equals($this->expectedToken(), $token);
    }

    private function extractBearerToken(Request $request): ?string
    {
        $header = trim((string) $request->header("Authorization", ""));
        if ($header === "") {
            return null;
        }

        if (!str_starts_with($header, "Bearer ")) {
            return null;
        }

        $token = trim(substr($header, 7));
        return $token !== "" ? $token : null;
    }

    private function expectedToken(): string
    {
        $configured = (string) env("KC_MOBILE_API_TOKEN", self::DEFAULT_MOBILE_TOKEN);
        $normalized = trim($configured);
        return $normalized !== "" ? $normalized : self::DEFAULT_MOBILE_TOKEN;
    }
}
