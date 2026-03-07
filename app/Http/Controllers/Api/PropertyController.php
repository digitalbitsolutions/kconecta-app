<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ApiAccessService;
use App\Services\AuthSessionService;
use App\Services\PropertyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PropertyController extends Controller
{
    public function __construct(
        private readonly PropertyService $propertyService,
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
                    "properties_index",
                    "token_invalid",
                    false
                ),
                401
            );
        }

        if (!$this->hasAllowedRole($request, ["manager", "admin"])) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_ROLE_SCOPE_FORBIDDEN,
                    "Forbidden",
                    "properties_index",
                    "role_scope_forbidden",
                    false
                ),
                403
            );
        }

        $filters = [
            "status" => $request->query("status"),
            "city" => $request->query("city"),
            "manager_id" => $request->query("manager_id"),
        ];

        $payload = $this->propertyService->listProperties($filters);

        return response()->json($payload, 200);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "properties_show",
                    "token_invalid",
                    false
                ),
                401
            );
        }

        if (!$this->hasAllowedRole($request, ["manager", "admin"])) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_ROLE_SCOPE_FORBIDDEN,
                    "Forbidden",
                    "properties_show",
                    "role_scope_forbidden",
                    false
                ),
                403
            );
        }

        $property = $this->propertyService->findPropertyById($id);
        if ($property === null) {
            return response()->json(
                [
                    "message" => "Property not found",
                    "property_id" => $id,
                ],
                404
            );
        }

        return response()->json(["data" => $property], 200);
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
