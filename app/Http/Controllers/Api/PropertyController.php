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

        $validated = $request->validate([
            "status" => ["nullable", "string", "max:50"],
            "city" => ["nullable", "string", "max:120"],
            "manager_id" => ["nullable", "string", "max:120"],
            "search" => ["nullable", "string", "max:120"],
            "page" => ["nullable", "integer", "min:1"],
            "per_page" => ["nullable", "integer", "min:1", "max:100"],
        ]);

        $filters = [
            "status" => $validated["status"] ?? null,
            "city" => $validated["city"] ?? null,
            "manager_id" => $validated["manager_id"] ?? null,
            "search" => $validated["search"] ?? null,
            "page" => $validated["page"] ?? 1,
            "per_page" => $validated["per_page"] ?? 25,
        ];

        $payload = $this->propertyService->listProperties($filters);

        return response()->json($payload, 200);
    }

    public function summary(Request $request): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "properties_summary",
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
                    "properties_summary",
                    "role_scope_forbidden",
                    false
                ),
                403
            );
        }

        $payload = $this->propertyService->summaryProperties();
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
