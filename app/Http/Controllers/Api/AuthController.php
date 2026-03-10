<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ApiAccessService;
use App\Services\AuthSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuthSessionService $authSessionService,
        private readonly ApiAccessService $apiAccessService
    )
    {
    }

    public function login(Request $request): JsonResponse
    {
        $payload = $request->validate([
            "email" => ["required", "string", "email"],
            "password" => ["required", "string"],
        ]);

        if (!$this->authSessionService->canLogin((string) $payload["password"])) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_INVALID_CREDENTIALS,
                    "Invalid credentials",
                    "login",
                    "invalid_credentials",
                    true
                ),
                401
            );
        }

        return response()->json(
            $this->authSessionService->buildLoginPayload((string) $payload["email"]),
            200
        );
    }

    public function refresh(Request $request): JsonResponse
    {
        $refreshToken = trim((string) $request->input("refresh_token", ""));
        if ($refreshToken !== "") {
            $validation = $this->authSessionService->validateToken($refreshToken, "refresh");
            if ((bool) ($validation["valid"] ?? false)) {
                $claims = (array) ($validation["payload"] ?? []);
                return response()->json(
                    $this->authSessionService->buildRefreshPayloadFromClaims($claims),
                    200
                );
            }

            if (str_starts_with($refreshToken, "rtk_")) {
                return response()->json(
                    $this->authSessionService->buildLegacyRefreshPayload($refreshToken),
                    200
                );
            }

            $errorCode = (bool) ($validation["expired"] ?? false)
                ? AuthSessionService::ERROR_TOKEN_EXPIRED
                : AuthSessionService::ERROR_TOKEN_INVALID;
            $reason = $errorCode === AuthSessionService::ERROR_TOKEN_EXPIRED
                ? "token_expired"
                : "token_invalid";

            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    $errorCode,
                    "Unauthorized",
                    "refresh",
                    $reason,
                    $errorCode !== AuthSessionService::ERROR_TOKEN_INVALID
                ),
                401
            );
        }

        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "refresh",
                    "token_invalid",
                    false
                ),
                401
            );
        }

        return response()->json(
            $this->authSessionService->buildLegacyRefreshPayload(null),
            200
        );
    }

    public function logout(Request $request): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "logout",
                    "token_invalid",
                    false
                ),
                401
            );
        }

        return response()->json($this->authSessionService->buildLogoutPayload(), 200);
    }

    public function me(Request $request): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "me",
                    "token_invalid",
                    false
                ),
                401
            );
        }

        $claims = $this->apiAccessService->resolveAccessTokenClaims($request);
        $role = $this->resolveRoleFromContext($request, $claims);
        if (!in_array($role, ["manager", "admin"], true)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_ROLE_SCOPE_FORBIDDEN,
                    "Forbidden",
                    "me",
                    "role_scope_forbidden",
                    false
                ),
                403
            );
        }

        $scope = $claims["scope"] ?? null;
        if (!is_array($scope)) {
            $scope = $this->authSessionService->scopesForRole($role);
        }

        $email = strtolower(trim((string) ($claims["email"] ?? "")));
        if ($email === "") {
            $email = "mobile@kconecta.local";
        }

        $providerId = null;
        if (is_numeric($claims["provider_id"] ?? null)) {
            $candidate = (int) $claims["provider_id"];
            $providerId = $candidate > 0 ? $candidate : null;
        }

        $issuedAt = (int) ($claims["iat"] ?? 0);
        $issuedAtIso = $issuedAt > 0 ? gmdate("c", $issuedAt) : gmdate("c");

        return response()->json(
            [
                "data" => [
                    "subject" => $email,
                    "email" => $email,
                    "role" => $role,
                    "scope" => array_values($scope),
                    "provider_id" => $providerId,
                    "issued_at" => $issuedAtIso,
                ],
                "meta" => [
                    "contract" => AuthSessionService::CONTRACT,
                    "mode" => AuthSessionService::MODE,
                    "flow" => "me",
                    "reason" => "session_resolved",
                ],
            ],
            200
        );
    }

    private function resolveRoleFromContext(Request $request, array $claims): string
    {
        $role = strtolower(trim((string) ($claims["role"] ?? "")));
        if ($role !== "") {
            return $role;
        }

        $headerRole = strtolower(trim((string) $request->header("X-KCONECTA-ROLE", "")));
        if ($headerRole !== "") {
            return $headerRole;
        }

        return "manager";
    }
}
