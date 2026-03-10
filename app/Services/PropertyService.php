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

        return [
            "data" => [
                "kpis" => $summary,
            ],
            "meta" => [
                "contract" => "manager-portfolio-summary-v1",
                "source" => $dataset["source"],
            ],
        ];
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
            "city" => trim((string) ($payload["city"] ?? "Unknown")),
            "status" => $this->normalizeStatus($payload["status"] ?? self::STATUS_AVAILABLE),
            "manager_id" => $this->resolveMutationManagerId($payload["manager_id"] ?? null, $managerId, $role),
            "price" => $this->asFloat($payload["price"] ?? null),
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

        if (!$changed) {
            return $this->conflictResult("No property changes detected", "no_changes");
        }

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

        return $this->applyRuntimeOverrides([
            "id" => $id,
            "title" => $title !== null && $title !== "" ? $title : "Property {$id}",
            "city" => $city !== null && $city !== "" ? $city : "Unknown",
            "status" => $status,
            "manager_id" => $managerId,
            "provider_id" => $providerId,
            "price" => $price,
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

    private function asString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);
        return $normalized !== "" ? $normalized : null;
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

    private function seedRows(): array
    {
        return array_map(
            fn (array $row): array => $this->applyRuntimeOverrides($row),
            [
            [
                "id" => 101,
                "title" => "Modern Loft Center",
                "city" => "Madrid",
                "status" => "available",
                "manager_id" => "mgr-001",
                "provider_id" => null,
                "price" => 235000,
            ],
            [
                "id" => 102,
                "title" => "Family Home North",
                "city" => "Barcelona",
                "status" => "reserved",
                "manager_id" => "mgr-001",
                "provider_id" => 2,
                "price" => 310000,
            ],
            [
                "id" => 103,
                "title" => "City Apartment East",
                "city" => "Valencia",
                "status" => "available",
                "manager_id" => "mgr-002",
                "provider_id" => null,
                "price" => 198000,
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
            "data" => $property,
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
            "city" => $property["city"] ?? "Unknown",
            "status" => $property["status"] ?? self::STATUS_AVAILABLE,
            "manager_id" => $property["manager_id"] ?? null,
            "provider_id" => $property["provider_id"] ?? null,
            "assigned_at" => $property["assigned_at"] ?? null,
            "handoff_note" => $property["handoff_note"] ?? null,
            "price" => $property["price"] ?? null,
        ];
    }
}
