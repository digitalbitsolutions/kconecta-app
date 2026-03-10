<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ApiAccessService;
use App\Services\AuthSessionService;
use App\Services\PropertyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

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

    public function create(Request $request): JsonResponse
    {
        $authFailure = $this->authorizeMutationRequest($request, "properties_create");
        if ($authFailure !== null) {
            return $authFailure;
        }

        $validated = $this->validatePropertyFormPayload($request, "properties_create", true);
        if ($validated instanceof JsonResponse) {
            return $validated;
        }

        $result = $this->propertyService->createProperty(
            $validated,
            $this->resolveManagerId($request),
            $this->resolveRole($request)
        );

        return $this->formMutationResponse("properties_create", $result);
    }

    public function reserve(Request $request, int $id): JsonResponse
    {
        $authFailure = $this->authorizeMutationRequest($request, "properties_reserve");
        if ($authFailure !== null) {
            return $authFailure;
        }

        $result = $this->propertyService->reserveProperty($id, $this->resolveManagerId($request));
        return $this->mutationResponse("properties_reserve", $result);
    }

    public function release(Request $request, int $id): JsonResponse
    {
        $authFailure = $this->authorizeMutationRequest($request, "properties_release");
        if ($authFailure !== null) {
            return $authFailure;
        }

        $result = $this->propertyService->releaseProperty($id);
        return $this->mutationResponse("properties_release", $result);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $authFailure = $this->authorizeMutationRequest($request, "properties_update");
        if ($authFailure !== null) {
            return $authFailure;
        }

        $validated = $this->validatePropertyFormPayload($request, "properties_update", false);
        if ($validated instanceof JsonResponse) {
            return $validated;
        }

        $result = $this->propertyService->editProperty(
            $id,
            $validated,
            $this->resolveManagerId($request),
            $this->resolveRole($request)
        );

        return $this->formMutationResponse("properties_update", $result);
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

    private function authorizeMutationRequest(Request $request, string $flow): ?JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    $flow,
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
                    $flow,
                    "role_scope_forbidden",
                    false
                ),
                403
            );
        }

        return null;
    }

    private function mutationResponse(string $flow, array $result): JsonResponse
    {
        if (($result["ok"] ?? false) === true) {
            return response()->json(
                [
                    "data" => $result["data"],
                    "meta" => [
                        "contract" => "property-mutation-v1",
                        "flow" => $flow,
                        "reason" => $result["reason"] ?? "ok",
                    ],
                ],
                200
            );
        }

        if (($result["status"] ?? 500) === 404) {
            return response()->json(
                [
                    "message" => $result["message"] ?? "Property not found",
                    "property_id" => $result["property_id"] ?? null,
                    "error" => [
                        "code" => $result["code"] ?? "PROPERTY_NOT_FOUND",
                        "message" => $result["message"] ?? "Property not found",
                    ],
                    "meta" => [
                        "contract" => "property-mutation-v1",
                        "flow" => $flow,
                        "reason" => $result["reason"] ?? "property_not_found",
                        "retryable" => (bool) ($result["retryable"] ?? false),
                    ],
                ],
                404
            );
        }

        return response()->json(
            [
                "error" => [
                    "code" => $result["code"] ?? "PROPERTY_STATE_CONFLICT",
                    "message" => $result["message"] ?? "Property mutation conflict",
                ],
                "meta" => [
                    "contract" => "property-mutation-v1",
                    "flow" => $flow,
                    "reason" => $result["reason"] ?? "conflict",
                    "retryable" => (bool) ($result["retryable"] ?? true),
                ],
            ],
            (int) ($result["status"] ?? 409)
        );
    }

    private function formMutationResponse(string $flow, array $result): JsonResponse
    {
        if (($result["ok"] ?? false) === true) {
            return response()->json(
                [
                    "data" => $result["data"],
                    "meta" => [
                        "contract" => "manager-property-form-v1",
                        "flow" => $flow,
                        "reason" => $result["reason"] ?? "ok",
                    ],
                ],
                (int) ($result["status"] ?? 200)
            );
        }

        if (($result["status"] ?? 500) === 404) {
            return response()->json(
                [
                    "message" => $result["message"] ?? "Property not found",
                    "property_id" => $result["property_id"] ?? null,
                    "error" => [
                        "code" => $result["code"] ?? "PROPERTY_NOT_FOUND",
                        "message" => $result["message"] ?? "Property not found",
                    ],
                    "meta" => [
                        "contract" => "manager-property-form-v1",
                        "flow" => $flow,
                        "reason" => $result["reason"] ?? "property_not_found",
                        "retryable" => (bool) ($result["retryable"] ?? false),
                    ],
                ],
                404
            );
        }

        return response()->json(
            [
                "error" => [
                    "code" => $result["code"] ?? "PROPERTY_STATE_CONFLICT",
                    "message" => $result["message"] ?? "Property update conflict",
                ],
                "meta" => [
                    "contract" => "manager-property-form-v1",
                    "flow" => $flow,
                    "reason" => $result["reason"] ?? "conflict",
                    "retryable" => (bool) ($result["retryable"] ?? true),
                ],
            ],
            (int) ($result["status"] ?? 409)
        );
    }

    private function validatePropertyFormPayload(
        Request $request,
        string $flow,
        bool $isCreate
    ): array|JsonResponse
    {
        $rules = [
            "title" => [
                $isCreate ? "required" : "sometimes",
                "string",
                "min:3",
                "max:160",
            ],
            "city" => [
                $isCreate ? "required" : "sometimes",
                "string",
                "min:2",
                "max:120",
            ],
            "status" => [
                $isCreate ? "required" : "sometimes",
                "string",
                "in:" . implode(",", [
                    PropertyService::STATUS_AVAILABLE,
                    PropertyService::STATUS_RESERVED,
                    PropertyService::STATUS_MAINTENANCE,
                ]),
            ],
            "price" => ["sometimes", "numeric", "min:0"],
            "manager_id" => ["sometimes", "string", "max:120"],
        ];

        $validator = Validator::make($request->all(), $rules);
        $validator->after(function ($validator) use ($request, $isCreate): void {
            if ($isCreate) {
                return;
            }

            $editableFields = ["title", "city", "status", "price", "manager_id"];
            $hasAnyEditableField = false;

            foreach ($editableFields as $field) {
                if ($request->has($field)) {
                    $hasAnyEditableField = true;
                    break;
                }
            }

            if (!$hasAnyEditableField) {
                $validator->errors()->add("payload", "At least one editable field is required.");
            }
        });

        if ($validator->fails()) {
            return $this->propertyFormValidationResponse($flow, $validator->errors()->toArray());
        }

        return $validator->validated();
    }

    private function propertyFormValidationResponse(string $flow, array $fields): JsonResponse
    {
        return response()->json(
            [
                "error" => [
                    "code" => "VALIDATION_ERROR",
                    "message" => "Validation failed",
                    "fields" => $fields,
                ],
                "meta" => [
                    "contract" => "manager-property-form-v1",
                    "flow" => $flow,
                    "reason" => "validation_error",
                    "retryable" => true,
                ],
            ],
            422
        );
    }

    private function resolveManagerId(Request $request): ?string
    {
        $managerId = trim((string) data_get($request->user(), "id", ""));
        if ($managerId !== "") {
            return $managerId;
        }

        $header = trim((string) $request->header("X-KCONECTA-MANAGER-ID", ""));
        return $header !== "" ? $header : null;
    }
}
