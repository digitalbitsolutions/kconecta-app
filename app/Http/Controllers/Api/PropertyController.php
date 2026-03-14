<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ApiAccessService;
use App\Services\AuthSessionService;
use App\Services\ProviderService;
use App\Services\PropertyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PropertyController extends Controller
{
    public function __construct(
        private readonly PropertyService $propertyService,
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
            "status" => [
                "nullable",
                "string",
                "in:" . implode(",", [
                    PropertyService::STATUS_AVAILABLE,
                    PropertyService::STATUS_RESERVED,
                    PropertyService::STATUS_MAINTENANCE,
                ]),
            ],
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

    public function priorityQueue(Request $request): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "properties_priority_queue",
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
                    "properties_priority_queue",
                    "role_scope_forbidden",
                    false
                ),
                403
            );
        }

        $validated = $request->validate([
            "category" => [
                "nullable",
                "string",
                "in:" . implode(",", [
                    "provider_assignment",
                    "maintenance_follow_up",
                    "portfolio_review",
                    "quality_alert",
                ]),
            ],
            "severity" => [
                "nullable",
                "string",
                "in:high,medium,low",
            ],
            "status" => [
                "nullable",
                "string",
                "in:" . implode(",", [
                    PropertyService::STATUS_AVAILABLE,
                    PropertyService::STATUS_RESERVED,
                    PropertyService::STATUS_MAINTENANCE,
                ]),
            ],
            "search" => ["nullable", "string", "max:120"],
            "limit" => ["nullable", "integer", "min:1", "max:100"],
        ]);

        $payload = $this->propertyService->priorityQueue([
            "category" => $validated["category"] ?? null,
            "severity" => $validated["severity"] ?? null,
            "status" => $validated["status"] ?? null,
            "search" => $validated["search"] ?? null,
            "limit" => $validated["limit"] ?? null,
        ]);

        return response()->json($payload, 200);
    }

    public function priorityQueueShow(Request $request, string $queueItemId): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "properties_priority_queue_detail",
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
                    "properties_priority_queue_detail",
                    "role_scope_forbidden",
                    false
                ),
                403
            );
        }

        $item = $this->propertyService->findPriorityQueueItem($queueItemId);
        if ($item === null) {
            return response()->json(
                [
                    "error" => [
                        "code" => "QUEUE_ITEM_NOT_FOUND",
                        "message" => "Queue item not found",
                    ],
                    "meta" => [
                        "contract" => "manager-assignment-center-v1",
                        "flow" => "properties_priority_queue_detail",
                        "reason" => "queue_item_not_found",
                        "retryable" => false,
                    ],
                    "queue_item_id" => $queueItemId,
                ],
                404
            );
        }

        $providerId = (int) ($item["provider_id"] ?? 0);
        $provider = $providerId > 0 ? $this->providerService->findProviderById($providerId) : null;
        $payload = $this->propertyService->buildPriorityQueueItemDetailPayload($item, $provider);

        return response()->json($payload, 200);
    }

    public function priorityQueueComplete(Request $request, string $queueItemId): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "properties_priority_queue_complete",
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
                    "properties_priority_queue_complete",
                    "role_scope_forbidden",
                    false
                ),
                403
            );
        }

        $validator = Validator::make(
            $request->all(),
            [
                "resolution_code" => ["sometimes", "string", "in:assigned,deferred,resolved,dismissed"],
                "note" => ["sometimes", "string", "max:300"],
            ]
        );

        if ($validator->fails()) {
            return response()->json(
                [
                    "error" => [
                        "code" => "VALIDATION_ERROR",
                        "message" => "Validation failed",
                        "fields" => $validator->errors()->toArray(),
                    ],
                    "meta" => [
                        "contract" => "manager-priority-queue-action-v1",
                        "flow" => "properties_priority_queue_complete",
                        "reason" => "validation_error",
                        "retryable" => true,
                    ],
                ],
                422
            );
        }

        $result = $this->propertyService->completePriorityQueueItem(
            $queueItemId,
            $validator->validated(),
            $this->resolveManagerId($request)
        );

        return $this->queueActionResponse("properties_priority_queue_complete", $result);
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

        return response()->json(
            [
                "data" => $this->propertyService->buildPropertyDetailPayload($property),
            ],
            200
        );
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

    public function providerCandidates(Request $request, int $id): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "properties_provider_candidates",
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
                    "properties_provider_candidates",
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
                    "error" => [
                        "code" => "PROPERTY_NOT_FOUND",
                        "message" => "Property not found",
                    ],
                    "meta" => [
                        "contract" => "manager-provider-handoff-v1",
                        "flow" => "properties_provider_candidates",
                        "reason" => "property_not_found",
                        "retryable" => false,
                    ],
                    "property_id" => $id,
                ],
                404
            );
        }

        $providersPayload = $this->providerService->listProviders([
            "status" => "active",
            "role" => "service_provider",
        ]);

        return response()->json(
            [
                "data" => [
                    "property_id" => $id,
                    "candidates" => array_values($providersPayload["data"] ?? []),
                ],
                "meta" => [
                    "contract" => "manager-provider-handoff-v1",
                    "flow" => "properties_provider_candidates",
                    "reason" => "candidates_loaded",
                    "source" => data_get($providersPayload, "meta.source", "unknown"),
                ],
            ],
            200
        );
    }

    public function assignProvider(Request $request, int $id): JsonResponse
    {
        $authFailure = $this->authorizeMutationRequest($request, "properties_assign_provider");
        if ($authFailure !== null) {
            return $authFailure;
        }

        $validator = Validator::make(
            $request->all(),
            [
                "provider_id" => ["required", "integer", "min:1"],
                "note" => ["sometimes", "string", "max:300"],
            ]
        );

        if ($validator->fails()) {
            return response()->json(
                [
                    "error" => [
                        "code" => "VALIDATION_ERROR",
                        "message" => "Validation failed",
                        "fields" => $validator->errors()->toArray(),
                    ],
                    "meta" => [
                        "contract" => "manager-provider-handoff-v1",
                        "flow" => "properties_assign_provider",
                        "reason" => "validation_error",
                        "retryable" => true,
                    ],
                ],
                422
            );
        }

        $validated = $validator->validated();
        $providerId = (int) ($validated["provider_id"] ?? 0);
        $provider = $this->providerService->findProviderById($providerId);
        if ($provider === null) {
            return response()->json(
                [
                    "error" => [
                        "code" => "PROVIDER_NOT_FOUND",
                        "message" => "Provider not found",
                    ],
                    "meta" => [
                        "contract" => "manager-provider-handoff-v1",
                        "flow" => "properties_assign_provider",
                        "reason" => "provider_not_found",
                        "retryable" => false,
                    ],
                    "provider_id" => $providerId,
                ],
                404
            );
        }

        $providerStatus = strtolower((string) ($provider["status"] ?? ""));
        if ($providerStatus !== "active") {
            return response()->json(
                [
                    "error" => [
                        "code" => "ASSIGNMENT_CONFLICT",
                        "message" => "Provider is not active for assignment",
                    ],
                    "meta" => [
                        "contract" => "manager-provider-handoff-v1",
                        "flow" => "properties_assign_provider",
                        "reason" => "provider_inactive",
                        "retryable" => true,
                    ],
                ],
                409
            );
        }

        $result = $this->propertyService->assignProvider(
            $id,
            $providerId,
            isset($validated["note"]) ? (string) $validated["note"] : null,
            $this->resolveManagerId($request)
        );

        if (($result["ok"] ?? false) === true) {
            $result["assignment_evidence"] = $this->propertyService->buildAssignmentEvidencePayload(
                $id,
                $result["data"],
                $provider
            );
        }

        return $this->handoffMutationResponse("properties_assign_provider", $result, $providerId);
    }

    public function assignmentContext(Request $request, int $id): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "properties_assignment_context",
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
                    "properties_assignment_context",
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
                    "error" => [
                        "code" => "PROPERTY_NOT_FOUND",
                        "message" => "Property not found",
                    ],
                    "meta" => [
                        "contract" => "manager-provider-context-v1",
                        "flow" => "properties_assignment_context",
                        "reason" => "property_not_found",
                        "retryable" => false,
                    ],
                    "property_id" => $id,
                ],
                404
            );
        }

        $providerId = isset($property["provider_id"]) ? (int) $property["provider_id"] : 0;
        $provider = $providerId > 0 ? $this->providerService->findProviderById($providerId) : null;
        $payload = $this->propertyService->buildAssignmentContextPayload($id, $property, $provider);

        return response()->json($payload, 200);
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
            "description" => ["sometimes", "string", "min:1", "max:2000"],
            "address" => ["sometimes", "string", "min:1", "max:200"],
            "postal_code" => ["sometimes", "string", "min:1", "max:20"],
            "property_type" => ["sometimes", "string", "min:1", "max:80"],
            "operation_mode" => ["sometimes", "string", "in:sale,rent,both"],
            "sale_price" => ["sometimes", "nullable", "numeric", "min:0"],
            "rental_price" => ["sometimes", "nullable", "numeric", "min:0"],
            "garage_price_category_id" => ["sometimes", "nullable", "integer", "min:1"],
            "garage_price" => ["sometimes", "nullable", "numeric", "min:0"],
            "bedrooms" => ["sometimes", "nullable", "integer", "min:0"],
            "bathrooms" => ["sometimes", "nullable", "integer", "min:0"],
            "rooms" => ["sometimes", "nullable", "integer", "min:0"],
            "elevator" => ["sometimes", "nullable", "boolean"],
            "manager_id" => ["sometimes", "string", "max:120"],
        ];

        $validator = Validator::make($request->all(), $rules);
        $validator->after(function ($validator) use ($request, $isCreate): void {
            if (!$isCreate && !$this->hasAnyEditableField($request)) {
                $validator->errors()->add("payload", "At least one editable field is required.");
            }

            $operationMode = strtolower(trim((string) $request->input("operation_mode", "")));
            if (in_array($operationMode, ["sale", "both"], true) && !$this->requestHasValue($request, "sale_price")) {
                $validator->errors()->add("sale_price", "Sale price is required for the selected operation mode.");
            }

            if (in_array($operationMode, ["rent", "both"], true) && !$this->requestHasValue($request, "rental_price")) {
                $validator->errors()->add("rental_price", "Rental price is required for the selected operation mode.");
            }

            if ($this->requestHasValue($request, "garage_price_category_id") && !$this->requestHasValue($request, "garage_price")) {
                $validator->errors()->add("garage_price", "Garage price is required when a garage price category is selected.");
            }

            $propertyType = strtolower(trim((string) $request->input("property_type", "")));
            if ($propertyType !== "" && $this->isResidentialPropertyType($propertyType)) {
                if (!$this->requestHasValue($request, "bedrooms")) {
                    $validator->errors()->add("bedrooms", "Bedrooms are required for residential property types.");
                }
                if (!$this->requestHasValue($request, "bathrooms")) {
                    $validator->errors()->add("bathrooms", "Bathrooms are required for residential property types.");
                }
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

    private function hasAnyEditableField(Request $request): bool
    {
        foreach ($this->propertyFormEditableFields() as $field) {
            if ($request->exists($field)) {
                return true;
            }
        }

        return false;
    }

    private function propertyFormEditableFields(): array
    {
        return [
            "title",
            "description",
            "address",
            "city",
            "postal_code",
            "status",
            "property_type",
            "operation_mode",
            "price",
            "sale_price",
            "rental_price",
            "garage_price_category_id",
            "garage_price",
            "bedrooms",
            "bathrooms",
            "rooms",
            "elevator",
            "manager_id",
        ];
    }

    private function requestHasValue(Request $request, string $field): bool
    {
        if (!$request->exists($field)) {
            return false;
        }

        $value = $request->input($field);
        if ($value === null) {
            return false;
        }

        if (is_string($value)) {
            return trim($value) !== "";
        }

        if (is_array($value)) {
            return $value !== [];
        }

        return true;
    }

    private function isResidentialPropertyType(string $propertyType): bool
    {
        return in_array(
            strtolower(trim($propertyType)),
            ["apartment", "flat", "house", "chalet", "duplex", "studio", "penthouse", "residential"],
            true
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

    private function handoffMutationResponse(
        string $flow,
        array $result,
        ?int $providerId = null
    ): JsonResponse
    {
        if (($result["ok"] ?? false) === true) {
            $data = [
                "property" => $result["data"],
                "property_id" => (int) ($result["data"]["id"] ?? 0),
                "provider_id" => (int) (($result["data"]["provider_id"] ?? $providerId) ?? 0),
                "assigned_at" => $result["data"]["assigned_at"] ?? now()->toIso8601String(),
            ];

            if (is_array($result["assignment_evidence"] ?? null)) {
                $data["assignment"] = $result["assignment_evidence"]["assignment"] ?? null;
                $data["latest_timeline_event"] = $result["assignment_evidence"]["latest_timeline_event"] ?? null;
            }

            return response()->json(
                [
                    "data" => $data,
                    "meta" => [
                        "contract" => "manager-provider-handoff-v1",
                        "flow" => $flow,
                        "reason" => $result["reason"] ?? "provider_assigned",
                    ],
                ],
                200
            );
        }

        if (($result["status"] ?? 500) === 404) {
            return response()->json(
                [
                    "error" => [
                        "code" => $result["code"] ?? "PROPERTY_NOT_FOUND",
                        "message" => $result["message"] ?? "Property not found",
                    ],
                    "meta" => [
                        "contract" => "manager-provider-handoff-v1",
                        "flow" => $flow,
                        "reason" => $result["reason"] ?? "property_not_found",
                        "retryable" => (bool) ($result["retryable"] ?? false),
                    ],
                    "property_id" => $result["property_id"] ?? null,
                ],
                404
            );
        }

        return response()->json(
            [
                "error" => [
                    "code" => $result["code"] ?? "ASSIGNMENT_CONFLICT",
                    "message" => $result["message"] ?? "Provider assignment conflict",
                ],
                "meta" => [
                    "contract" => "manager-provider-handoff-v1",
                    "flow" => $flow,
                    "reason" => $result["reason"] ?? "assignment_conflict",
                    "retryable" => (bool) ($result["retryable"] ?? true),
                ],
            ],
            (int) ($result["status"] ?? 409)
        );
    }

    private function queueActionResponse(string $flow, array $result): JsonResponse
    {
        if (($result["ok"] ?? false) === true) {
            return response()->json(
                [
                    "data" => [
                        "item" => $result["data"],
                    ],
                    "meta" => [
                        "contract" => "manager-priority-queue-action-v1",
                        "flow" => $flow,
                        "reason" => $result["reason"] ?? "queue_item_completed",
                    ],
                ],
                200
            );
        }

        $status = (int) ($result["status"] ?? 409);
        if ($status === 404) {
            return response()->json(
                [
                    "error" => [
                        "code" => $result["code"] ?? "QUEUE_ITEM_NOT_FOUND",
                        "message" => $result["message"] ?? "Queue item not found",
                    ],
                    "meta" => [
                        "contract" => "manager-priority-queue-action-v1",
                        "flow" => $flow,
                        "reason" => $result["reason"] ?? "queue_item_not_found",
                        "retryable" => (bool) ($result["retryable"] ?? false),
                    ],
                    "queue_item_id" => $result["queue_item_id"] ?? null,
                ],
                404
            );
        }

        return response()->json(
            [
                "error" => [
                    "code" => $result["code"] ?? "QUEUE_ACTION_CONFLICT",
                    "message" => $result["message"] ?? "Queue action conflict",
                ],
                "meta" => [
                    "contract" => "manager-priority-queue-action-v1",
                    "flow" => $flow,
                    "reason" => $result["reason"] ?? "queue_conflict",
                    "retryable" => (bool) ($result["retryable"] ?? true),
                ],
                "queue_item_id" => $result["queue_item_id"] ?? null,
            ],
            $status
        );
    }
}
