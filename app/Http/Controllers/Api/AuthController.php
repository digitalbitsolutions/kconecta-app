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
}
