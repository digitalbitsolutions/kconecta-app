<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ApiAccessService;
use App\Services\AuthSessionService;
use App\Services\ProviderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ProviderController extends Controller
{
    private const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

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

    public function availability(Request $request, int $id): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "providers_availability_show",
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
                    "providers_availability_show",
                    "role_scope_forbidden",
                    false
                ),
                403
            );
        }

        if ($this->isProviderIdentityMismatch($request, $id)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_PROVIDER_IDENTITY_MISMATCH,
                    "Forbidden",
                    "providers_availability_show",
                    "provider_identity_mismatch",
                    false
                ),
                403
            );
        }

        $payload = $this->providerService->getAvailability($id);
        if ($payload === null) {
            return response()->json(
                [
                    "message" => "Provider not found",
                    "provider_id" => $id,
                ],
                404
            );
        }

        return response()->json($payload, 200);
    }

    public function updateAvailability(Request $request, int $id): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_TOKEN_INVALID,
                    "Unauthorized",
                    "providers_availability_update",
                    "token_invalid",
                    false
                ),
                401
            );
        }

        if (!$this->hasAllowedRole($request, ["provider", "admin"])) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_ROLE_SCOPE_FORBIDDEN,
                    "Forbidden",
                    "providers_availability_update",
                    "role_scope_forbidden",
                    false
                ),
                403
            );
        }

        if ($this->isProviderIdentityMismatch($request, $id)) {
            return response()->json(
                $this->authSessionService->buildErrorPayload(
                    AuthSessionService::ERROR_PROVIDER_IDENTITY_MISMATCH,
                    "Forbidden",
                    "providers_availability_update",
                    "provider_identity_mismatch",
                    false
                ),
                403
            );
        }

        $validator = Validator::make(
            $request->all(),
            [
                "timezone" => ["nullable", "string", "max:64"],
                "slots" => ["required", "array", "min:1"],
                "slots.*.day" => ["required", "string", "in:" . implode(",", self::WEEK_DAYS)],
                "slots.*.start" => ["required", "date_format:H:i"],
                "slots.*.end" => ["required", "date_format:H:i"],
                "slots.*.enabled" => ["required", "boolean"],
            ]
        );

        $validator->after(function ($validation) use ($request): void {
            $slots = $request->input("slots", []);
            if (!is_array($slots)) {
                return;
            }

            foreach ($slots as $index => $slot) {
                $start = trim((string) data_get($slot, "start", ""));
                $end = trim((string) data_get($slot, "end", ""));
                if ($start === "" || $end === "") {
                    continue;
                }

                if (strcmp($start, $end) >= 0) {
                    $validation
                        ->errors()
                        ->add(
                            "slots.{$index}.end",
                            "The end time must be greater than the start time."
                        );
                }
            }
        });

        if ($validator->fails()) {
            return response()->json(
                [
                    "error" => [
                        "code" => "VALIDATION_FAILED",
                        "message" => "Invalid availability payload",
                    ],
                    "meta" => [
                        "contract" => ProviderService::AVAILABILITY_CONTRACT,
                        "flow" => "providers_availability_update",
                        "reason" => "validation_failed",
                        "retryable" => true,
                    ],
                    "details" => $validator->errors(),
                ],
                422
            );
        }

        $validated = $validator->validated();
        $payload = $this->providerService->updateAvailability(
            $id,
            (array) ($validated["slots"] ?? []),
            isset($validated["timezone"]) ? (string) $validated["timezone"] : null
        );

        if ($payload === null) {
            return response()->json(
                [
                    "message" => "Provider not found",
                    "provider_id" => $id,
                ],
                404
            );
        }

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

    private function resolveProviderIdentity(Request $request): ?int
    {
        $candidate = data_get($request->user(), "provider_id");
        if (is_numeric($candidate) && (int) $candidate > 0) {
            return (int) $candidate;
        }

        $header = trim((string) $request->header("X-KCONECTA-PROVIDER-ID", ""));
        if (is_numeric($header) && (int) $header > 0) {
            return (int) $header;
        }

        return null;
    }

    private function isProviderIdentityMismatch(Request $request, int $targetProviderId): bool
    {
        if ($this->resolveRole($request) !== "provider") {
            return false;
        }

        $sessionProviderId = $this->resolveProviderIdentity($request);
        if ($sessionProviderId === null) {
            return true;
        }

        return $sessionProviderId !== $targetProviderId;
    }
}
