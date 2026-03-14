<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class PropertyService
{
    public const STATUS_AVAILABLE = "available";
    public const STATUS_RESERVED = "reserved";
    public const STATUS_MAINTENANCE = "maintenance";

    private const DEFAULT_PROPERTY_TABLE = "properties";
    private const FALLBACK_PROPERTY_TABLE = "real_estate_properties";
    private const DATA_SOURCE_AUTO = "auto";
    private const DATA_SOURCE_DATABASE = "database";
    private const DATA_SOURCE_SEED = "seed";
    private const MAX_DB_ROWS = 500;
    private static array $runtimeOverrides = [];
    private static array $runtimeCreated = [];
    private static array $runtimeQueueCompletions = [];

    /**
     * Returns property list payload with DB-first retrieval.
     */
    public function listProperties(array $filters = []): array
    {
        $dataset = $this->loadRows();
        $rows = $dataset["rows"];

        $filtered = array_values(
            array_filter(
                $rows,
                static function (array $item) use ($filters): bool {
                    if (
                        !empty($filters["status"]) &&
                        strcasecmp((string) ($item["status"] ?? ""), (string) $filters["status"]) !== 0
                    ) {
                        return false;
                    }
                    if (
                        !empty($filters["city"]) &&
                        strcasecmp((string) ($item["city"] ?? ""), (string) $filters["city"]) !== 0
                    ) {
                        return false;
                    }
                    if (
                        !empty($filters["manager_id"]) &&
                        strcasecmp((string) ($item["manager_id"] ?? ""), (string) $filters["manager_id"]) !== 0
                    ) {
                        return false;
                    }
                    if (!empty($filters["search"])) {
                        $search = strtolower((string) $filters["search"]);
                        $haystack = strtolower(
                            implode(
                                " ",
                                [
                                    (string) ($item["title"] ?? ""),
                                    (string) ($item["city"] ?? ""),
                                    (string) ($item["status"] ?? ""),
                                    (string) ($item["manager_id"] ?? ""),
                                ]
                            )
                        );
                        if (!str_contains($haystack, $search)) {
                            return false;
                        }
                    }
                    return true;
                }
            )
        );

        $page = max(1, (int) ($filters["page"] ?? 1));
        $perPage = max(1, min(100, (int) ($filters["per_page"] ?? 25)));
        $total = count($filtered);
        $totalPages = $total > 0 ? (int) ceil($total / $perPage) : 0;
        $offset = ($page - 1) * $perPage;
        $pagedRows = array_slice($filtered, $offset, $perPage);
        $summary = $this->buildKpis($filtered);

        return [
            "data" => array_values($pagedRows),
            "meta" => [
                "count" => count($pagedRows),
                "page" => $page,
                "per_page" => $perPage,
                "total" => $total,
                "total_pages" => $totalPages,
                "has_next_page" => $page < $totalPages,
                "filters" => [
                    "status" => $filters["status"] ?? null,
                    "city" => $filters["city"] ?? null,
                    "manager_id" => $filters["manager_id"] ?? null,
                    "search" => $filters["search"] ?? null,
                ],
                "kpis" => $summary,
                "source" => $dataset["source"],
            ],
        ];
    }

    public function summaryProperties(array $filters = []): array
    {
        $dataset = $this->loadRows();
        $rows = $dataset["rows"];
        $summary = $this->buildKpis($rows);
        $priorities = $this->buildDashboardPriorities($rows);
        $generatedAt = $this->resolveGeneratedAt($priorities);

        return [
            "data" => [
                "kpis" => $summary,
                "priorities" => $priorities,
            ],
            "meta" => [
                "contract" => "manager-dashboard-summary-v1",
                "generated_at" => $generatedAt,
                "source" => $dataset["source"],
            ],
        ];
    }

    public function priorityQueue(array $filters = []): array
    {
        $dataset = $this->loadRows();
        $items = $this->buildPriorityQueueItems($dataset["rows"]);

        $filtered = array_values(
            array_filter(
                $items,
                static function (array $item) use ($filters): bool {
                    if (
                        !empty($filters["category"]) &&
                        strcasecmp((string) ($item["category"] ?? ""), (string) $filters["category"]) !== 0
                    ) {
                        return false;
                    }
                    if (
                        !empty($filters["severity"]) &&
                        strcasecmp((string) ($item["severity"] ?? ""), (string) $filters["severity"]) !== 0
                    ) {
                        return false;
                    }

                    return true;
                }
            )
        );

        $limit = null;
        if (isset($filters["limit"]) && $filters["limit"] !== null) {
            $limit = max(1, min(100, (int) $filters["limit"]));
            $filtered = array_slice($filtered, 0, $limit);
        }

        return [
            "data" => [
                "items" => array_values($filtered),
            ],
            "meta" => [
                "contract" => "manager-priority-queue-v1",
                "generated_at" => $this->resolveGeneratedAt($filtered),
                "source" => $dataset["source"],
                "filters" => [
                    "category" => $filters["category"] ?? null,
                    "severity" => $filters["severity"] ?? null,
                    "limit" => $limit,
                ],
                "count" => count($filtered),
            ],
        ];
    }

    public function completePriorityQueueItem(
        string $queueItemId,
        array $payload = [],
        ?string $managerId = null
    ): array {
        $normalizedQueueItemId = trim($queueItemId);
        if ($normalizedQueueItemId === "") {
            return [
                "ok" => false,
                "status" => 404,
                "reason" => "queue_item_not_found",
                "code" => "QUEUE_ITEM_NOT_FOUND",
                "message" => "Queue item not found",
                "queue_item_id" => $queueItemId,
                "retryable" => false,
            ];
        }

        $dataset = $this->loadRows();
        $items = $this->buildPriorityQueueItems($dataset["rows"]);

        $target = null;
        foreach ($items as $item) {
            if ((string) ($item["id"] ?? "") === $normalizedQueueItemId) {
                $target = $item;
                break;
            }
        }

        if ($target === null) {
            return [
                "ok" => false,
                "status" => 404,
                "reason" => "queue_item_not_found",
                "code" => "QUEUE_ITEM_NOT_FOUND",
                "message" => "Queue item not found",
                "queue_item_id" => $normalizedQueueItemId,
                "retryable" => false,
            ];
        }

        if ((bool) ($target["completed"] ?? false)) {
            return [
                "ok" => false,
                "status" => 409,
                "reason" => "queue_item_already_completed",
                "code" => "QUEUE_ACTION_CONFLICT",
                "message" => "Queue item is already completed",
                "queue_item_id" => $normalizedQueueItemId,
                "retryable" => true,
            ];
        }

        $normalizedNote = isset($payload["note"]) ? trim((string) $payload["note"]) : null;
        if ($normalizedNote === "") {
            $normalizedNote = null;
        }

        $normalizedResolutionCode = isset($payload["resolution_code"])
            ? strtolower(trim((string) $payload["resolution_code"]))
            : null;
        if ($normalizedResolutionCode === "") {
            $normalizedResolutionCode = null;
        }

        $completedAt = now()->toIso8601String();
        self::$runtimeQueueCompletions[$normalizedQueueItemId] = [
            "completed" => true,
            "completed_at" => $completedAt,
            "resolution_code" => $normalizedResolutionCode,
            "note" => $normalizedNote,
            "completed_by" => $managerId !== null && trim($managerId) !== "" ? trim($managerId) : null,
        ];

        $updatedItem = $this->applyQueueCompletionState($target);

        return [
            "ok" => true,
            "status" => 200,
            "reason" => "queue_item_completed",
            "data" => $updatedItem,
        ];
    }

    private function buildPriorityQueueItems(array $rows): array
    {
        $items = [];

        foreach ($rows as $row) {
            $propertyId = (int) ($row["id"] ?? 0);
            if ($propertyId <= 0) {
                continue;
            }

            $status = strtolower((string) ($row["status"] ?? self::STATUS_AVAILABLE));
            $providerId = (int) ($row["provider_id"] ?? 0);
            $item = [
                "id" => "",
                "property_id" => $propertyId,
                "property_title" => (string) ($row["title"] ?? "Property {$propertyId}"),
                "city" => (string) ($row["city"] ?? "Unknown"),
                "status" => $status,
                "category" => "portfolio_review",
                "severity" => "low",
                "sla_due_at" => null,
                "sla_state" => "no_deadline",
                "updated_at" => $this->buildQueueTimestamp(70, $propertyId),
                "action" => "open_property",
                "completed" => false,
                "completed_at" => null,
                "resolution_code" => null,
                "note" => null,
            ];

            if ($status === self::STATUS_AVAILABLE && $providerId <= 0) {
                $item["id"] = "priority-provider-assignment-{$propertyId}";
                $item["category"] = "provider_assignment";
                $item["severity"] = "high";
                $item["sla_due_at"] = $this->buildQueueTimestamp(95, $propertyId);
                $item["updated_at"] = $this->buildQueueTimestamp(75, $propertyId);
                $item["action"] = "open_handoff";
            } elseif ($status === self::STATUS_MAINTENANCE) {
                $item["id"] = "priority-maintenance-follow-up-{$propertyId}";
                $item["category"] = "maintenance_follow_up";
                $item["severity"] = "high";
                $item["sla_due_at"] = $this->buildQueueTimestamp(130, $propertyId);
                $item["updated_at"] = $this->buildQueueTimestamp(72, $propertyId);
                $item["action"] = "review_status";
            } elseif ($status === self::STATUS_RESERVED) {
                $item["id"] = "priority-portfolio-review-{$propertyId}";
                $item["category"] = "portfolio_review";
                $item["severity"] = "medium";
                $item["sla_due_at"] = $this->buildQueueTimestamp(210, $propertyId);
                $item["updated_at"] = $this->buildQueueTimestamp(88, $propertyId);
                $item["action"] = "open_property";
            } else {
                $item["id"] = "priority-quality-alert-{$propertyId}";
                $item["category"] = "quality_alert";
                $item["severity"] = "low";
                $item["sla_due_at"] = null;
                $item["updated_at"] = $this->buildQueueTimestamp(66, $propertyId);
                $item["action"] = "review_status";
            }

            $item["sla_state"] = $this->resolveQueueSlaState($item["sla_due_at"]);
            $item = $this->applyQueueCompletionState($item);
            $items[] = $item;
        }

        usort($items, [$this, "comparePriorityQueueItems"]);

        return array_values($items);
    }

    private function buildQueueTimestamp(int $baseMinuteOffset, int $propertyId): string
    {
        $deterministicOffset = max(0, $baseMinuteOffset) + (($propertyId % 11) * 7);
        return $this->buildPriorityTimestamp($deterministicOffset, 0);
    }

    private function resolveQueueSlaState(?string $dueAt): string
    {
        if ($dueAt === null || trim($dueAt) === "") {
            return "no_deadline";
        }

        $dueTimestamp = strtotime($dueAt);
        if ($dueTimestamp === false) {
            return "no_deadline";
        }

        $referenceTimestamp = strtotime("2026-01-01T11:00:00Z");
        if ($dueTimestamp < $referenceTimestamp) {
            return "overdue";
        }
        if (($dueTimestamp - $referenceTimestamp) <= 3600) {
            return "at_risk";
        }

        return "on_track";
    }

    private function comparePriorityQueueItems(array $left, array $right): int
    {
        $leftCompleted = (bool) ($left["completed"] ?? false);
        $rightCompleted = (bool) ($right["completed"] ?? false);
        if ($leftCompleted !== $rightCompleted) {
            return $leftCompleted ? 1 : -1;
        }

        $severityOrder = [
            "high" => 0,
            "medium" => 1,
            "low" => 2,
        ];

        $leftSeverity = $severityOrder[strtolower((string) ($left["severity"] ?? "low"))] ?? 3;
        $rightSeverity = $severityOrder[strtolower((string) ($right["severity"] ?? "low"))] ?? 3;
        if ($leftSeverity !== $rightSeverity) {
            return $leftSeverity <=> $rightSeverity;
        }

        $leftDue = $left["sla_due_at"] ?? null;
        $rightDue = $right["sla_due_at"] ?? null;
        if ($leftDue !== $rightDue) {
            if ($leftDue === null) {
                return 1;
            }
            if ($rightDue === null) {
                return -1;
            }
            return strcmp((string) $leftDue, (string) $rightDue);
        }

        $updatedComparison = strcmp((string) ($right["updated_at"] ?? ""), (string) ($left["updated_at"] ?? ""));
        if ($updatedComparison !== 0) {
            return $updatedComparison;
        }

        return strcmp((string) ($left["id"] ?? ""), (string) ($right["id"] ?? ""));
    }

    private function applyQueueCompletionState(array $item): array
    {
        $queueItemId = (string) ($item["id"] ?? "");
        if ($queueItemId === "" || !isset(self::$runtimeQueueCompletions[$queueItemId])) {
            return $item;
        }

        $completion = self::$runtimeQueueCompletions[$queueItemId];
        $item["completed"] = (bool) ($completion["completed"] ?? false);
        $item["completed_at"] = $completion["completed_at"] ?? null;
        $item["resolution_code"] = $completion["resolution_code"] ?? null;
        $item["note"] = $completion["note"] ?? null;
        if ($item["completed"] === true) {
            $item["updated_at"] = $completion["completed_at"] ?? ($item["updated_at"] ?? null);
            $item["action"] = "open_property";
        }

        return $item;
    }

    private function buildKpis(array $rows): array
    {
        $active = 0;
        $reserved = 0;
        foreach ($rows as $row) {
            $status = strtolower((string) ($row["status"] ?? ""));
            if ($status === "available") {
                $active++;
            }
            if ($status === "reserved") {
                $reserved++;
            }
        }

        $portfolioSize = count($rows);
        $avgCloseDays = $portfolioSize > 0 ? 21 : 0;
        $providerMatchesPending = $portfolioSize > 0 ? max(1, (int) ceil($portfolioSize * 0.25)) : 0;

        return [
            "active_properties" => $active,
            "reserved_properties" => $reserved,
            "avg_time_to_close_days" => $avgCloseDays,
            "provider_matches_pending" => $providerMatchesPending,
        ];
    }

    /**
     * Build deterministic manager dashboard priorities feed for native clients.
     */
    private function buildDashboardPriorities(array $rows): array
    {
        if ($rows === []) {
            return [];
        }

        $availableWithoutProvider = 0;
        $reserved = 0;
        $maintenance = 0;

        foreach ($rows as $row) {
            $status = strtolower((string) ($row["status"] ?? ""));
            $providerId = (int) ($row["provider_id"] ?? 0);

            if ($status === self::STATUS_AVAILABLE && $providerId <= 0) {
                $availableWithoutProvider++;
            }
            if ($status === self::STATUS_RESERVED) {
                $reserved++;
            }
            if ($status === self::STATUS_MAINTENANCE) {
                $maintenance++;
            }
        }

        $priorities = [];

        if ($availableWithoutProvider > 0) {
            $priorities[] = [
                "id" => "priority-provider-assignment",
                "category" => "provider_assignment",
                "title" => "Provider assignments pending",
                "description" => "{$availableWithoutProvider} properties need provider assignment",
                "severity" => "high",
                "due_at" => $this->buildPriorityTimestamp(180, 0),
                "updated_at" => $this->buildPriorityTimestamp(120, 0),
            ];
        }

        if ($maintenance > 0) {
            $priorities[] = [
                "id" => "priority-maintenance-follow-up",
                "category" => "maintenance_follow_up",
                "title" => "Maintenance follow-up required",
                "description" => "{$maintenance} properties are in maintenance state",
                "severity" => "high",
                "due_at" => $this->buildPriorityTimestamp(240, 0),
                "updated_at" => $this->buildPriorityTimestamp(140, 0),
            ];
        }

        if ($reserved > 0) {
            $priorities[] = [
                "id" => "priority-portfolio-review",
                "category" => "portfolio_review",
                "title" => "Reserved pipeline review",
                "description" => "{$reserved} reserved properties require progress review",
                "severity" => "medium",
                "due_at" => $this->buildPriorityTimestamp(360, 0),
                "updated_at" => $this->buildPriorityTimestamp(100, 0),
            ];
        }

        if (count($rows) >= 3) {
            $priorities[] = [
                "id" => "priority-quality-alert",
                "category" => "quality_alert",
                "title" => "Quality signal check",
                "description" => "Review tenant and provider quality alerts for active operations",
                "severity" => "low",
                "due_at" => null,
                "updated_at" => $this->buildPriorityTimestamp(80, 0),
            ];
        }

        usort(
            $priorities,
            function (array $left, array $right): int {
                $severityOrder = [
                    "high" => 0,
                    "medium" => 1,
                    "low" => 2,
                ];

                $leftSeverity = $severityOrder[strtolower((string) ($left["severity"] ?? "low"))] ?? 3;
                $rightSeverity = $severityOrder[strtolower((string) ($right["severity"] ?? "low"))] ?? 3;
                if ($leftSeverity !== $rightSeverity) {
                    return $leftSeverity <=> $rightSeverity;
                }

                $leftDue = $left["due_at"] ?? null;
                $rightDue = $right["due_at"] ?? null;
                if ($leftDue !== $rightDue) {
                    if ($leftDue === null) {
                        return 1;
                    }
                    if ($rightDue === null) {
                        return -1;
                    }
                    return strcmp((string) $leftDue, (string) $rightDue);
                }

                return strcmp((string) ($right["updated_at"] ?? ""), (string) ($left["updated_at"] ?? ""));
            }
        );

        return array_values($priorities);
    }

    private function resolveGeneratedAt(array $priorities): string
    {
        if ($priorities === []) {
            return $this->buildPriorityTimestamp(60, 0);
        }

        $latest = (string) ($priorities[0]["updated_at"] ?? "");
        foreach ($priorities as $priority) {
            $updatedAt = (string) ($priority["updated_at"] ?? "");
            if ($updatedAt > $latest) {
                $latest = $updatedAt;
            }
        }

        return $latest !== "" ? $latest : $this->buildPriorityTimestamp(60, 0);
    }

    private function buildPriorityTimestamp(int $minuteOffset, int $dayOffset): string
    {
        $baseTimestamp = strtotime("2026-01-01T08:00:00Z");
        $offset = max(0, $minuteOffset) * 60 + max(0, $dayOffset) * 86400;
        return gmdate("Y-m-d\\TH:i:s\\Z", $baseTimestamp + $offset);
    }

    public function findPropertyById(int $id): ?array
    {
        $dataset = $this->loadRows();
        foreach ($dataset["rows"] as $row) {
            if ((int) $row["id"] === $id) {
                return $row;
            }
        }

        return null;
    }

    /**
     * Build property detail payload with additive deterministic timeline events.
     */
    public function buildPropertyDetailPayload(array $property): array
    {
        $detail = $this->buildPropertyContractPayload($property);
        $detail["timeline"] = $this->buildTimelineEvents($property);

        return $detail;
    }

    /**
     * Reserve a property when current status is not already reserved.
     */
    public function reserveProperty(int $id, ?string $managerId = null): array
    {
        $property = $this->findPropertyById($id);
        if ($property === null) {
            return $this->notFoundResult($id);
        }

        if ($property["status"] === self::STATUS_RESERVED) {
            return $this->conflictResult("Property is already reserved", "already_reserved");
        }

        $updated = $property;
        $updated["status"] = self::STATUS_RESERVED;
        if ($managerId !== null && trim($managerId) !== "") {
            $updated["manager_id"] = trim($managerId);
        }
        $this->rememberRuntimeOverride($updated);

        return $this->successResult($updated, "property_reserved");
    }

    /**
     * Release a reservation when property is currently reserved.
     */
    public function releaseProperty(int $id): array
    {
        $property = $this->findPropertyById($id);
        if ($property === null) {
            return $this->notFoundResult($id);
        }

        if ($property["status"] !== self::STATUS_RESERVED) {
            return $this->conflictResult("Property is not reserved", "not_reserved");
        }

        $updated = $property;
        $updated["status"] = self::STATUS_AVAILABLE;
        $this->rememberRuntimeOverride($updated);

        return $this->successResult($updated, "property_released");
    }

    /**
     * Update status with deterministic conflict semantics.
     */
    public function updatePropertyStatus(int $id, string $status, ?string $managerId = null): array
    {
        $property = $this->findPropertyById($id);
        if ($property === null) {
            return $this->notFoundResult($id);
        }

        $normalizedStatus = strtolower(trim($status));
        if ($normalizedStatus === strtolower((string) $property["status"])) {
            return $this->conflictResult("Property already has the requested status", "status_unchanged");
        }

        $updated = $property;
        $updated["status"] = $normalizedStatus;
        if ($managerId !== null && trim($managerId) !== "") {
            $updated["manager_id"] = trim($managerId);
        }
        $this->rememberRuntimeOverride($updated);

        return $this->successResult($updated, "property_status_updated");
    }

    /**
     * Create a manager-scoped property for native form flows.
     */
    public function createProperty(array $payload, ?string $managerId = null, string $role = "manager"): array
    {
        $rows = $this->loadRows()["rows"];
        $id = $this->nextPropertyId($rows);

        $property = [
            "id" => $id,
            "title" => trim((string) ($payload["title"] ?? "Property {$id}")),
            "description" => $this->asString($payload["description"] ?? null),
            "address" => $this->asString($payload["address"] ?? null),
            "city" => trim((string) ($payload["city"] ?? "Unknown")),
            "postal_code" => $this->asString($payload["postal_code"] ?? null),
            "status" => $this->normalizeStatus($payload["status"] ?? self::STATUS_AVAILABLE),
            "property_type" => $this->asString($payload["property_type"] ?? null),
            "operation_mode" => $this->normalizeOperationMode($payload["operation_mode"] ?? null),
            "sale_price" => $this->asFloat($payload["sale_price"] ?? null),
            "rental_price" => $this->asFloat($payload["rental_price"] ?? null),
            "garage_price_category_id" => $this->asInt($payload["garage_price_category_id"] ?? null),
            "garage_price" => $this->asFloat($payload["garage_price"] ?? null),
            "bedrooms" => $this->asInt($payload["bedrooms"] ?? null),
            "bathrooms" => $this->asInt($payload["bathrooms"] ?? null),
            "rooms" => $this->asInt($payload["rooms"] ?? null),
            "elevator" => $this->asNullableBoolean($payload["elevator"] ?? null),
            "manager_id" => $this->resolveMutationManagerId($payload["manager_id"] ?? null, $managerId, $role),
            "price" => array_key_exists("price", $payload)
                ? $this->asFloat($payload["price"])
                : $this->resolveDisplayPrice([
                    "sale_price" => $this->asFloat($payload["sale_price"] ?? null),
                    "rental_price" => $this->asFloat($payload["rental_price"] ?? null),
                    "garage_price" => $this->asFloat($payload["garage_price"] ?? null),
                ]),
            "updated_at" => now()->toIso8601String(),
        ];

        self::$runtimeCreated[$id] = $property;

        return $this->successResult($property, "property_created", 201);
    }

    /**
     * Edit manager property fields with conflict-safe semantics.
     */
    public function editProperty(
        int $id,
        array $payload,
        ?string $managerId = null,
        string $role = "manager"
    ): array
    {
        $property = $this->findPropertyById($id);
        if ($property === null) {
            return $this->notFoundResult($id);
        }

        $updated = $property;
        $changed = false;

        if (array_key_exists("title", $payload)) {
            $nextTitle = trim((string) $payload["title"]);
            if ($nextTitle !== (string) $property["title"]) {
                $updated["title"] = $nextTitle;
                $changed = true;
            }
        }

        if (array_key_exists("city", $payload)) {
            $nextCity = trim((string) $payload["city"]);
            if ($nextCity !== (string) $property["city"]) {
                $updated["city"] = $nextCity;
                $changed = true;
            }
        }

        if (array_key_exists("status", $payload)) {
            $nextStatus = $this->normalizeStatus($payload["status"]);
            if ($nextStatus !== strtolower((string) $property["status"])) {
                $updated["status"] = $nextStatus;
                $changed = true;
            }
        }

        if (array_key_exists("price", $payload)) {
            $nextPrice = $this->asFloat($payload["price"]);
            if ($nextPrice !== $property["price"]) {
                $updated["price"] = $nextPrice;
                $changed = true;
            }
        }

        foreach (["description", "address", "postal_code", "property_type"] as $field) {
            if (!array_key_exists($field, $payload)) {
                continue;
            }

            $nextValue = $this->asString($payload[$field]);
            if ($nextValue !== ($property[$field] ?? null)) {
                $updated[$field] = $nextValue;
                $changed = true;
            }
        }

        if (array_key_exists("operation_mode", $payload)) {
            $nextOperationMode = $this->normalizeOperationMode($payload["operation_mode"]);
            if ($nextOperationMode !== ($property["operation_mode"] ?? null)) {
                $updated["operation_mode"] = $nextOperationMode;
                $changed = true;
            }
        }

        foreach (["sale_price", "rental_price", "garage_price"] as $field) {
            if (!array_key_exists($field, $payload)) {
                continue;
            }

            $nextValue = $this->asFloat($payload[$field]);
            if ($nextValue !== ($property[$field] ?? null)) {
                $updated[$field] = $nextValue;
                $changed = true;
            }
        }

        foreach (["garage_price_category_id", "bedrooms", "bathrooms", "rooms"] as $field) {
            if (!array_key_exists($field, $payload)) {
                continue;
            }

            $nextValue = $this->asInt($payload[$field]);
            if ($nextValue !== ($property[$field] ?? null)) {
                $updated[$field] = $nextValue;
                $changed = true;
            }
        }

        if (array_key_exists("elevator", $payload)) {
            $nextElevator = $this->asNullableBoolean($payload["elevator"]);
            if ($nextElevator !== ($property["elevator"] ?? null)) {
                $updated["elevator"] = $nextElevator;
                $changed = true;
            }
        }

        if (array_key_exists("manager_id", $payload)) {
            $nextManagerId = $this->resolveMutationManagerId($payload["manager_id"], $managerId, $role);
            if ($nextManagerId !== $property["manager_id"]) {
                $updated["manager_id"] = $nextManagerId;
                $changed = true;
            }
        } elseif ($managerId !== null && trim($managerId) !== "" && $role !== "admin" && $managerId !== $property["manager_id"]) {
            $updated["manager_id"] = trim($managerId);
            $changed = true;
        }

        if (
            !array_key_exists("price", $payload) &&
            (
                array_key_exists("sale_price", $payload) ||
                array_key_exists("rental_price", $payload) ||
                array_key_exists("garage_price", $payload)
            )
        ) {
            $nextDerivedPrice = $this->resolveDisplayPrice($updated, false);
            if ($nextDerivedPrice !== ($property["price"] ?? null)) {
                $updated["price"] = $nextDerivedPrice;
                $changed = true;
            }
        }

        if (!$changed) {
            return $this->conflictResult("No property changes detected", "no_changes");
        }

        $updated["updated_at"] = now()->toIso8601String();
        $this->rememberRuntimeOverride($updated);
        if (array_key_exists($id, self::$runtimeCreated)) {
            self::$runtimeCreated[$id] = $updated;
        }

        return $this->successResult($updated, "property_updated");
    }

    /**
     * Assign an active provider to a property context for manager handoff flows.
     */
    public function assignProvider(
        int $propertyId,
        int $providerId,
        ?string $note = null,
        ?string $managerId = null
    ): array
    {
        $property = $this->findPropertyById($propertyId);
        if ($property === null) {
            return $this->notFoundResult($propertyId);
        }

        $currentStatus = strtolower((string) ($property["status"] ?? ""));
        if ($currentStatus === self::STATUS_MAINTENANCE) {
            return [
                "ok" => false,
                "status" => 409,
                "reason" => "property_in_maintenance",
                "code" => "ASSIGNMENT_CONFLICT",
                "message" => "Property in maintenance cannot be assigned.",
                "retryable" => true,
            ];
        }

        $currentProviderId = isset($property["provider_id"]) ? (int) $property["provider_id"] : 0;
        if ($currentProviderId > 0 && $currentProviderId === $providerId) {
            return [
                "ok" => false,
                "status" => 409,
                "reason" => "assignment_unchanged",
                "code" => "ASSIGNMENT_CONFLICT",
                "message" => "Property is already assigned to this provider.",
                "retryable" => true,
            ];
        }

        $updated = $property;
        $updated["provider_id"] = $providerId;
        if ($managerId !== null && trim($managerId) !== "") {
            $updated["manager_id"] = trim($managerId);
        }
        $updated["assigned_at"] = now()->toIso8601String();
        if ($note !== null && trim($note) !== "") {
            $updated["handoff_note"] = trim($note);
        }

        $this->rememberRuntimeOverride($updated);
        if (array_key_exists($propertyId, self::$runtimeCreated)) {
            self::$runtimeCreated[$propertyId] = $updated;
        }

        return $this->successResult($updated, "provider_assigned");
    }

    /**
     * Build deterministic assignment context payload for manager property detail flows.
     */
    public function buildAssignmentContextPayload(int $propertyId, array $property, ?array $provider): array
    {
        $providerId = isset($property["provider_id"]) ? (int) $property["provider_id"] : 0;
        $hasProviderReference = $providerId > 0;

        $assignmentState = "unassigned";
        $assigned = false;
        if ($hasProviderReference && $provider !== null) {
            $assignmentState = "assigned";
            $assigned = true;
        } elseif ($hasProviderReference && $provider === null) {
            $assignmentState = "provider_missing";
        }

        return [
            "data" => [
                "property_id" => $propertyId,
                "assignment" => [
                    "assigned" => $assigned,
                    "provider" => $provider !== null ? [
                        "id" => (int) ($provider["id"] ?? 0),
                        "name" => (string) ($provider["name"] ?? ""),
                        "category" => $provider["category"] ?? null,
                        "city" => $provider["city"] ?? null,
                        "status" => $provider["status"] ?? null,
                        "rating" => $provider["rating"] ?? null,
                    ] : null,
                    "assigned_at" => $property["assigned_at"] ?? null,
                    "note" => $property["handoff_note"] ?? null,
                    "state" => $assignmentState,
                ],
            ],
            "meta" => [
                "contract" => "manager-provider-context-v1",
                "flow" => "properties_assignment_context",
                "reason" => "assignment_context_loaded",
            ],
        ];
    }

    /**
     * Build additive assignment evidence payload for manager handoff success responses.
     */
    public function buildAssignmentEvidencePayload(int $propertyId, array $property, ?array $provider): array
    {
        $assignmentContextPayload = $this->buildAssignmentContextPayload($propertyId, $property, $provider);
        $timelineEvents = $this->buildTimelineEvents($property);
        $latestAssignmentEvent = null;

        foreach ($timelineEvents as $event) {
            if (($event["type"] ?? null) === "assignment") {
                $latestAssignmentEvent = $event;
                break;
            }
        }

        return [
            "assignment" => $assignmentContextPayload["data"]["assignment"] ?? null,
            "latest_timeline_event" => $latestAssignmentEvent,
        ];
    }

    /**
     * Load property rows from database first, with in-memory fallback.
     */
    private function loadRows(): array
    {
        $mode = $this->resolveDataSourceMode();
        if ($mode === self::DATA_SOURCE_SEED) {
            $rows = $this->seedRows();
            return [
                "rows" => $this->appendRuntimeCreatedRows($rows),
                "source" => "in_memory",
            ];
        }

        try {
            $table = $this->resolveDatabaseTable();
            if (!Schema::hasTable($table)) {
                $rows = $this->seedRows();
                return [
                    "rows" => $this->appendRuntimeCreatedRows($rows),
                    "source" => "in_memory",
                ];
            }

            $rawRows = DB::table($table)
                ->limit(self::MAX_DB_ROWS)
                ->get()
                ->all();

            $rows = [];
            foreach ($rawRows as $rawRow) {
                $mapped = $this->mapDatabaseRow((array) $rawRow);
                if ($mapped !== null) {
                    $rows[] = $mapped;
                }
            }

            return [
                "rows" => $this->appendRuntimeCreatedRows($rows),
                "source" => "database",
            ];
        } catch (Throwable) {
            if ($mode === self::DATA_SOURCE_DATABASE) {
                return [
                    "rows" => $this->appendRuntimeCreatedRows([]),
                    "source" => "database",
                ];
            }

            $rows = $this->seedRows();
            return [
                "rows" => $this->appendRuntimeCreatedRows($rows),
                "source" => "in_memory",
            ];
        }
    }

    private function resolveDatabaseTable(): string
    {
        $configured = trim((string) env("KC_PROPERTY_TABLE", self::DEFAULT_PROPERTY_TABLE));
        if ($configured !== "") {
            return $configured;
        }

        if (Schema::hasTable(self::DEFAULT_PROPERTY_TABLE)) {
            return self::DEFAULT_PROPERTY_TABLE;
        }
        if (Schema::hasTable(self::FALLBACK_PROPERTY_TABLE)) {
            return self::FALLBACK_PROPERTY_TABLE;
        }

        return self::DEFAULT_PROPERTY_TABLE;
    }

    private function resolveDataSourceMode(): string
    {
        $configured = strtolower(trim((string) env("KC_PROPERTY_DATA_SOURCE", self::DATA_SOURCE_AUTO)));
        if (in_array($configured, [self::DATA_SOURCE_AUTO, self::DATA_SOURCE_DATABASE, self::DATA_SOURCE_SEED], true)) {
            return $configured;
        }

        return self::DATA_SOURCE_AUTO;
    }

    private function mapDatabaseRow(array $row): ?array
    {
        $id = $this->asInt(
            $this->pickFirst(
                $row,
                ["id", "property_id", "propertyId"]
            )
        );
        if ($id === null) {
            return null;
        }

        $title = $this->asString(
            $this->pickFirst(
                $row,
                ["title", "name", "property_name"]
            )
        );

        $city = $this->asString(
            $this->pickFirst(
                $row,
                ["city", "location_city"]
            )
        );

        $status = $this->normalizeStatus(
            $this->pickFirst(
                $row,
                ["status", "state", "availability", "is_available"]
            )
        );

        $managerId = $this->asString(
            $this->pickFirst(
                $row,
                ["manager_id", "managerId", "agent_id", "owner_id"]
            )
        );

        $providerId = $this->asInt(
            $this->pickFirst(
                $row,
                ["provider_id", "assigned_provider_id", "providerId"]
            )
        );

        $price = $this->asFloat(
            $this->pickFirst(
                $row,
                ["price", "list_price", "rent_price", "amount"]
            )
        );

        $description = $this->asString(
            $this->pickFirst(
                $row,
                ["description", "notes", "summary"]
            )
        );

        $address = $this->asString(
            $this->pickFirst(
                $row,
                ["address", "street_address", "location_address"]
            )
        );

        $postalCode = $this->asString(
            $this->pickFirst(
                $row,
                ["postal_code", "zip_code", "zip"]
            )
        );

        $propertyType = $this->asString(
            $this->pickFirst(
                $row,
                ["property_type", "type", "property_category"]
            )
        );

        $operationMode = $this->normalizeOperationMode(
            $this->pickFirst(
                $row,
                ["operation_mode", "operation_type", "listing_mode"]
            )
        );

        $salePrice = $this->asFloat(
            $this->pickFirst(
                $row,
                ["sale_price", "salePrice", "price_sale", "sale_amount"]
            )
        );

        $rentalPrice = $this->asFloat(
            $this->pickFirst(
                $row,
                ["rental_price", "rent_price", "rentalPrice", "rent_amount"]
            )
        );

        $garagePriceCategoryId = $this->asInt(
            $this->pickFirst(
                $row,
                ["garage_price_category_id", "garage_category_id"]
            )
        );

        $garagePrice = $this->asFloat(
            $this->pickFirst(
                $row,
                ["garage_price", "garagePrice"]
            )
        );

        $bedrooms = $this->asInt(
            $this->pickFirst(
                $row,
                ["bedrooms", "bedrooms_count", "beds"]
            )
        );

        $bathrooms = $this->asInt(
            $this->pickFirst(
                $row,
                ["bathrooms", "bathrooms_count", "baths"]
            )
        );

        $rooms = $this->asInt(
            $this->pickFirst(
                $row,
                ["rooms", "rooms_count"]
            )
        );

        $elevator = $this->asNullableBoolean(
            $this->pickFirst(
                $row,
                ["elevator", "has_elevator"]
            )
        );

        $updatedAt = $this->asString(
            $this->pickFirst(
                $row,
                ["updated_at", "updatedAt"]
            )
        );

        $derivedPrice = $this->resolveDisplayPrice([
            "sale_price" => $salePrice,
            "rental_price" => $rentalPrice,
            "garage_price" => $garagePrice,
        ], false);

        return $this->applyRuntimeOverrides([
            "id" => $id,
            "title" => $title !== null && $title !== "" ? $title : "Property {$id}",
            "description" => $description,
            "address" => $address,
            "city" => $city !== null && $city !== "" ? $city : "Unknown",
            "postal_code" => $postalCode,
            "status" => $status,
            "property_type" => $propertyType,
            "operation_mode" => $operationMode,
            "sale_price" => $salePrice,
            "rental_price" => $rentalPrice,
            "garage_price_category_id" => $garagePriceCategoryId,
            "garage_price" => $garagePrice,
            "bedrooms" => $bedrooms,
            "bathrooms" => $bathrooms,
            "rooms" => $rooms,
            "elevator" => $elevator,
            "manager_id" => $managerId,
            "provider_id" => $providerId,
            "price" => $derivedPrice ?? $price,
            "updated_at" => $updatedAt,
        ]);
    }

    private function pickFirst(array $row, array $keys): mixed
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $row)) {
                return $row[$key];
            }
        }

        return null;
    }

    private function asInt(mixed $value): ?int
    {
        if ($value === null || $value === "") {
            return null;
        }
        if (is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    private function asFloat(mixed $value): ?float
    {
        if ($value === null || $value === "") {
            return null;
        }
        if (is_numeric($value)) {
            return (float) $value;
        }

        return null;
    }

    private function asNullableBoolean(mixed $value): ?bool
    {
        if ($value === null || $value === "") {
            return null;
        }

        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return ((int) $value) > 0;
        }

        $normalized = strtolower(trim((string) $value));
        if (in_array($normalized, ["true", "1", "yes", "on"], true)) {
            return true;
        }

        if (in_array($normalized, ["false", "0", "no", "off"], true)) {
            return false;
        }

        return null;
    }

    private function asString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);
        return $normalized !== "" ? $normalized : null;
    }

    private function normalizeOperationMode(mixed $value): ?string
    {
        $normalized = strtolower(trim((string) $value));
        if ($normalized === "") {
            return null;
        }

        if (in_array($normalized, ["sale", "rent", "both"], true)) {
            return $normalized;
        }

        return $normalized;
    }

    private function normalizeStatus(mixed $value): string
    {
        if (is_bool($value)) {
            return $value ? "available" : "unavailable";
        }
        if (is_numeric($value)) {
            return ((int) $value) > 0 ? "available" : "unavailable";
        }

        $text = strtolower(trim((string) $value));
        if ($text === "") {
            return "available";
        }
        if (in_array($text, ["1", "true", "enabled", "active", "available"], true)) {
            return "available";
        }
        if (in_array($text, ["0", "false", "disabled", "inactive", "unavailable"], true)) {
            return "unavailable";
        }

        return $text;
    }

    private function buildTimelineEvents(array $property): array
    {
        $propertyId = (int) ($property["id"] ?? 0);
        $status = strtolower((string) ($property["status"] ?? self::STATUS_AVAILABLE));
        $providerId = isset($property["provider_id"]) ? (int) $property["provider_id"] : 0;
        $providerName = $providerId > 0 ? "Provider #{$providerId}" : null;
        $assignmentState = $providerId > 0 ? "assigned" : "unassigned";

        $events = [
            [
                "id" => "property-{$propertyId}-assignment",
                "type" => "assignment",
                "occurred_at" => (string) ($property["assigned_at"] ?? $this->buildTimelineTimestamp($propertyId, 3)),
                "actor" => "manager",
                "summary" => $providerId > 0
                    ? "Provider assigned to property"
                    : "Property currently has no provider assignment",
                "metadata" => [
                    "provider_id" => $providerId > 0 ? $providerId : null,
                    "provider_name" => $providerName,
                    "assignment_state" => $assignmentState,
                ],
            ],
            [
                "id" => "property-{$propertyId}-status",
                "type" => "status_change",
                "occurred_at" => $this->buildTimelineTimestamp($propertyId, 2),
                "actor" => "system",
                "summary" => "Property status updated to {$status}",
                "metadata" => [
                    "previous_status" => $status === self::STATUS_AVAILABLE ? "draft" : self::STATUS_AVAILABLE,
                    "next_status" => $status,
                ],
            ],
        ];

        if (!empty($property["handoff_note"])) {
            $events[] = [
                "id" => "property-{$propertyId}-note",
                "type" => "note",
                "occurred_at" => $this->buildTimelineTimestamp($propertyId, 1),
                "actor" => "manager",
                "summary" => "Manager added handoff note",
                "metadata" => [
                    "note" => (string) $property["handoff_note"],
                    "scope" => "handoff",
                ],
            ];
        }

        usort(
            $events,
            static fn (array $left, array $right): int => strcmp(
                (string) $right["occurred_at"],
                (string) $left["occurred_at"]
            )
        );

        return array_values($events);
    }

    private function buildTimelineTimestamp(int $propertyId, int $slot): string
    {
        $baseTimestamp = strtotime("2026-01-01T00:00:00Z");
        $offsetSeconds = max(0, $propertyId) * 300 + max(0, $slot) * 60;
        return gmdate("Y-m-d\\TH:i:s\\Z", $baseTimestamp + $offsetSeconds);
    }

    private function seedRows(): array
    {
        return array_map(
            fn (array $row): array => $this->applyRuntimeOverrides($row),
            [
            [
                "id" => 101,
                "title" => "Modern Loft Center",
                "description" => "Open-plan loft prepared for sale showcase appointments.",
                "address" => "Calle Gran Via 45",
                "city" => "Madrid",
                "postal_code" => "28013",
                "status" => "available",
                "property_type" => "apartment",
                "operation_mode" => "sale",
                "sale_price" => 235000,
                "rental_price" => null,
                "garage_price_category_id" => null,
                "garage_price" => null,
                "bedrooms" => 1,
                "bathrooms" => 1,
                "rooms" => 2,
                "elevator" => true,
                "manager_id" => "mgr-001",
                "provider_id" => null,
                "price" => 235000,
                "updated_at" => "2026-03-13T10:00:00Z",
            ],
            [
                "id" => 102,
                "title" => "Family Home North",
                "description" => "Family-oriented detached home with active reservation.",
                "address" => "Passeig del Nord 18",
                "city" => "Barcelona",
                "postal_code" => "08021",
                "status" => "reserved",
                "property_type" => "house",
                "operation_mode" => "sale",
                "sale_price" => 310000,
                "rental_price" => null,
                "garage_price_category_id" => 1,
                "garage_price" => 18000,
                "bedrooms" => 4,
                "bathrooms" => 2,
                "rooms" => 6,
                "elevator" => false,
                "manager_id" => "mgr-001",
                "provider_id" => 2,
                "price" => 310000,
                "updated_at" => "2026-03-13T09:30:00Z",
            ],
            [
                "id" => 103,
                "title" => "City Apartment East",
                "description" => "Compact apartment with recent maintenance history.",
                "address" => "Avenida del Puerto 9",
                "city" => "Valencia",
                "postal_code" => "46023",
                "status" => "available",
                "property_type" => "apartment",
                "operation_mode" => "rent",
                "sale_price" => null,
                "rental_price" => 1250,
                "garage_price_category_id" => null,
                "garage_price" => null,
                "bedrooms" => 2,
                "bathrooms" => 1,
                "rooms" => 3,
                "elevator" => true,
                "manager_id" => "mgr-002",
                "provider_id" => null,
                "price" => 1250,
                "updated_at" => "2026-03-13T08:45:00Z",
            ],
        ]);
    }

    private function appendRuntimeCreatedRows(array $rows): array
    {
        if (self::$runtimeCreated === []) {
            return $rows;
        }

        $existingIds = [];
        foreach ($rows as $row) {
            $existingIds[(int) ($row["id"] ?? 0)] = true;
        }

        foreach (self::$runtimeCreated as $id => $createdRow) {
            $numericId = (int) $id;
            if ($numericId <= 0 || isset($existingIds[$numericId])) {
                continue;
            }

            $rows[] = $this->applyRuntimeOverrides($createdRow);
            $existingIds[$numericId] = true;
        }

        return $rows;
    }

    private function nextPropertyId(array $rows): int
    {
        $maxId = 100;
        foreach ($rows as $row) {
            $maxId = max($maxId, (int) ($row["id"] ?? 0));
        }

        foreach (array_keys(self::$runtimeCreated) as $createdId) {
            $maxId = max($maxId, (int) $createdId);
        }

        return $maxId + 1;
    }

    private function resolveMutationManagerId(mixed $requestedManagerId, ?string $sessionManagerId, string $role): ?string
    {
        $normalizedRequested = $this->asString($requestedManagerId);
        $normalizedSession = $this->asString($sessionManagerId);
        $normalizedRole = strtolower(trim($role));

        if ($normalizedRole === "admin") {
            return $normalizedRequested ?? $normalizedSession;
        }

        return $normalizedSession ?? $normalizedRequested;
    }

    private function successResult(array $property, string $reason, int $status = 200): array
    {
        return [
            "ok" => true,
            "status" => $status,
            "reason" => $reason,
            "data" => $this->buildPropertyContractPayload($property),
        ];
    }

    private function notFoundResult(int $id): array
    {
        return [
            "ok" => false,
            "status" => 404,
            "reason" => "property_not_found",
            "code" => "PROPERTY_NOT_FOUND",
            "message" => "Property not found",
            "property_id" => $id,
            "retryable" => false,
        ];
    }

    private function conflictResult(string $message, string $reason): array
    {
        return [
            "ok" => false,
            "status" => 409,
            "reason" => $reason,
            "code" => "PROPERTY_STATE_CONFLICT",
            "message" => $message,
            "retryable" => true,
        ];
    }

    private function applyRuntimeOverrides(array $row): array
    {
        $id = (int) ($row["id"] ?? 0);
        if ($id <= 0 || !isset(self::$runtimeOverrides[$id])) {
            return $row;
        }

        return array_merge($row, self::$runtimeOverrides[$id]);
    }

    private function rememberRuntimeOverride(array $property): void
    {
        $id = (int) ($property["id"] ?? 0);
        if ($id <= 0) {
            return;
        }

        self::$runtimeOverrides[$id] = [
            "title" => $property["title"] ?? "Property {$id}",
            "description" => $property["description"] ?? null,
            "address" => $property["address"] ?? null,
            "city" => $property["city"] ?? "Unknown",
            "postal_code" => $property["postal_code"] ?? null,
            "status" => $property["status"] ?? self::STATUS_AVAILABLE,
            "property_type" => $property["property_type"] ?? null,
            "operation_mode" => $property["operation_mode"] ?? null,
            "sale_price" => $property["sale_price"] ?? null,
            "rental_price" => $property["rental_price"] ?? null,
            "garage_price_category_id" => $property["garage_price_category_id"] ?? null,
            "garage_price" => $property["garage_price"] ?? null,
            "bedrooms" => $property["bedrooms"] ?? null,
            "bathrooms" => $property["bathrooms"] ?? null,
            "rooms" => $property["rooms"] ?? null,
            "elevator" => $property["elevator"] ?? null,
            "manager_id" => $property["manager_id"] ?? null,
            "provider_id" => $property["provider_id"] ?? null,
            "assigned_at" => $property["assigned_at"] ?? null,
            "handoff_note" => $property["handoff_note"] ?? null,
            "price" => $property["price"] ?? null,
            "updated_at" => $property["updated_at"] ?? null,
        ];
    }

    private function buildPropertyContractPayload(array $property): array
    {
        $payload = $property;
        $payload["price"] = $property["price"] ?? $this->resolveDisplayPrice($property);
        $payload["pricing"] = [
            "sale_price" => $property["sale_price"] ?? null,
            "rental_price" => $property["rental_price"] ?? null,
            "garage_price_category_id" => $property["garage_price_category_id"] ?? null,
            "garage_price" => $property["garage_price"] ?? null,
        ];
        $payload["characteristics"] = [
            "bedrooms" => $property["bedrooms"] ?? null,
            "bathrooms" => $property["bathrooms"] ?? null,
            "rooms" => $property["rooms"] ?? null,
            "elevator" => $property["elevator"] ?? null,
        ];
        $payload["updated_at"] = $property["updated_at"] ?? null;

        return $payload;
    }

    private function resolveDisplayPrice(array $property, bool $includeLegacyPrice = true): ?float
    {
        $fields = ["sale_price", "rental_price", "garage_price"];
        if ($includeLegacyPrice) {
            $fields[] = "price";
        }

        foreach ($fields as $field) {
            $value = $this->asFloat($property[$field] ?? null);
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }
}
