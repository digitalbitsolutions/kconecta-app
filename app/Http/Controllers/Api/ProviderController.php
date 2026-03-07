<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ApiAccessService;
use App\Services\AuthSessionService;
use App\Services\ProviderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProviderController extends Controller
{
    public function __construct(
        private readonly ProviderService $providerService,
        private readonly ApiAccessService $apiAccessService,
        private readonly AuthSessionService $authSessionService
    )
    {
    }

    public function index(Request $request): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "providers_index",
                    "token_invalid",
                    false
                ),
                401
            );
        }

        if (!$this->hasAllowedRole($request, ["manager", "provider", "admin"])) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_ROLE_SCOPE_FORBIDDEN,
                    "Forbidden",
                    "providers_index",
                    "role_scope_forbidden",
                    false
                ),
                403
            );
        }

        $filters = [
            "role" => $request->query("role"),
            "status" => $request->query("status"),
        ];

        $payload = $this->providerService->listProviders($filters);

        return response()->json($payload, 200);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "providers_show",
                    "token_invalid",
                    false
                ),
                401
            );
        }

        if (!$this->hasAllowedRole($request, ["manager", "provider", "admin"])) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_ROLE_SCOPE_FORBIDDEN,
                    "Forbidden",
                    "providers_show",
                    "role_scope_forbidden",
                    false
                ),
                403
            );
        }

        $provider = $this->providerService->findProviderById($id);
        if ($provider === null) {
            return response()->json(
                [
                    "message" => "Provider not found",
                    "provider_id" => $id,
                ],
                404
            );
        }

        return response()->json(["data" => $provider], 200);
    }

    private function hasAllowedRole(Request $request, array $allowedRoles): bool
    {
        $resolvedRole = $this->resolveRole($request);
        return in_array($resolvedRole, $allowedRoles, true);
    }

    private function resolveRole(Request $request): string
    {
        $userRole = strtolower((string) data_get($request->user(), "role", ""));
        if ($userRole !== "") {
            return $userRole;
        }

        $roleHeader = strtolower(trim((string) $request->header("X-KCONECTA-ROLE", "")));
        if ($roleHeader !== "") {
            return $roleHeader;
        }

        return "manager";
    }
}
