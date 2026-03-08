<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class ProviderService
{
    public const AVAILABILITY_CONTRACT = "provider-availability-v1";

    private const DEFAULT_PROVIDER_TABLE = "providers";
    private const FALLBACK_PROVIDER_TABLE = "service_providers";
    private const AVAILABILITY_TABLE = "provider_availability";
    private const DATA_SOURCE_AUTO = "auto";
    private const DATA_SOURCE_DATABASE = "database";
    private const DATA_SOURCE_SEED = "seed";
    private const MAX_DB_ROWS = 500;
    private const DEFAULT_AVAILABILITY_TIMEZONE = "Europe/Madrid";
    private const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    private static array $availabilityRevisions = [];

    /**
     * Returns provider list payload using DB-first retrieval with safe fallback.
     */
    public function listProviders(array $filters = []): array
    {
        $dataset = $this->loadRows();
        $rows = $dataset["rows"];

        $filtered = array_values(
            array_filter(
                $rows,
                static function (array $item) use ($filters): bool {
                    if (
                        !empty($filters["role"]) &&
                        strcasecmp((string) ($item["role"] ?? ""), (string) $filters["role"]) !== 0
                    ) {
                        return false;
                    }
                    if (
                        !empty($filters["status"]) &&
                        strcasecmp((string) ($item["status"] ?? ""), (string) $filters["status"]) !== 0
                    ) {
                        return false;
                    }
                    return true;
                }
            )
        );

        return [
            "data" => $filtered,
            "meta" => [
                "count" => count($filtered),
                "filters" => [
                    "role" => $filters["role"] ?? null,
                    "status" => $filters["status"] ?? null,
                ],
                "source" => $dataset["source"],
            ],
        ];
    }

    public function findProviderById(int $id): ?array
    {
        $dataset = $this->loadRows();
        foreach ($dataset["rows"] as $row) {
            if ((int) $row["id"] === $id) {
                return $row;
            }
        }

        return null;
    }

    public function getAvailability(int $providerId): ?array
    {
        $provider = $this->findProviderById($providerId);
        if ($provider === null) {
            return null;
        }

        $snapshot = $this->loadAvailabilitySnapshot($providerId);

        return [
            "data" => [
                "provider_id" => $providerId,
                "timezone" => $snapshot["timezone"],
                "slots" => $snapshot["slots"],
                "revision" => $snapshot["revision"],
            ],
            "meta" => [
                "contract" => self::AVAILABILITY_CONTRACT,
                "source" => $snapshot["source"],
            ],
        ];
    }

    public function updateAvailability(int $providerId, array $slots, ?string $timezone = null): ?array
    {
        $provider = $this->findProviderById($providerId);
        if ($provider === null) {
            return null;
        }

        $currentSnapshot = $this->loadAvailabilitySnapshot($providerId);
        $normalizedSlots = $this->normalizeAvailabilitySlots($slots);
        if ($normalizedSlots === []) {
            $normalizedSlots = $this->defaultAvailabilitySlots();
        }

        $resolvedTimezone = $this->normalizeTimezone($timezone);
        $source = $this->persistAvailabilitySnapshot(
            $providerId,
            $resolvedTimezone,
            $normalizedSlots
        );
        $nextRevision = ((int) ($currentSnapshot["revision"] ?? 0)) + 1;
        self::$availabilityRevisions[$providerId] = max(1, $nextRevision);

        return [
            "data" => [
                "provider_id" => $providerId,
                "timezone" => $resolvedTimezone,
                "slots" => $normalizedSlots,
                "updated_at" => now()->toIso8601String(),
                "revision" => self::$availabilityRevisions[$providerId],
            ],
            "meta" => [
                "contract" => self::AVAILABILITY_CONTRACT,
                "source" => $source,
            ],
        ];
    }

    /**
     * Load provider rows from database first, with in-memory fallback for local bootstrap.
     */
    private function loadRows(): array
    {
        $mode = $this->resolveDataSourceMode();
        if ($mode === self::DATA_SOURCE_SEED) {
            return [
                "rows" => $this->seedRows(),
                "source" => "in_memory",
            ];
        }

        try {
            $table = $this->resolveDatabaseTable();
            if (!Schema::hasTable($table)) {
                return [
                    "rows" => $this->seedRows(),
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
                "rows" => $rows,
                "source" => "database",
            ];
        } catch (Throwable) {
            if ($mode === self::DATA_SOURCE_DATABASE) {
                return [
                    "rows" => [],
                    "source" => "database",
                ];
            }

            return [
                "rows" => $this->seedRows(),
                "source" => "in_memory",
            ];
        }
    }

    private function loadAvailabilitySnapshot(int $providerId): array
    {
        $fromDedicatedTable = $this->loadAvailabilityFromDedicatedTable($providerId);
        if ($fromDedicatedTable !== null) {
            return $fromDedicatedTable;
        }

        $fromProviderTable = $this->loadAvailabilityFromProviderTable($providerId);
        if ($fromProviderTable !== null) {
            return $fromProviderTable;
        }

        $dataset = $this->loadRows();
        return [
            "timezone" => self::DEFAULT_AVAILABILITY_TIMEZONE,
            "slots" => $this->defaultAvailabilitySlots(),
            "source" => $dataset["source"],
            "revision" => $this->resolveAvailabilityRevision(
                $providerId,
                self::DEFAULT_AVAILABILITY_TIMEZONE,
                $this->defaultAvailabilitySlots()
            ),
        ];
    }

    private function loadAvailabilityFromDedicatedTable(int $providerId): ?array
    {
        try {
            if (!Schema::hasTable(self::AVAILABILITY_TABLE)) {
                return null;
            }

            $idColumn = $this->resolveExistingColumn(self::AVAILABILITY_TABLE, ["provider_id", "id"]);
            $slotsColumn = $this->resolveExistingColumn(
                self::AVAILABILITY_TABLE,
                ["slots_json", "slots", "availability_slots", "availability_json"]
            );
            if ($idColumn === null || $slotsColumn === null) {
                return null;
            }

            $timezoneColumn = $this->resolveExistingColumn(
                self::AVAILABILITY_TABLE,
                ["timezone", "availability_timezone", "tz"]
            );

            $rowObject = DB::table(self::AVAILABILITY_TABLE)
                ->where($idColumn, $providerId)
                ->first();
            if ($rowObject === null) {
                return null;
            }

            $row = (array) $rowObject;
            $slots = $this->parseSlotsFromRow($row[$slotsColumn] ?? null);
            if ($slots === []) {
                $slots = $this->defaultAvailabilitySlots();
            }

            $timezone = $timezoneColumn !== null
                ? $this->normalizeTimezone($this->asString($row[$timezoneColumn] ?? null))
                : self::DEFAULT_AVAILABILITY_TIMEZONE;

            return [
                "timezone" => $timezone,
                "slots" => $slots,
                "source" => "database",
                "revision" => $this->resolveAvailabilityRevision($providerId, $timezone, $slots),
            ];
        } catch (Throwable) {
            return null;
        }
    }

    private function loadAvailabilityFromProviderTable(int $providerId): ?array
    {
        try {
            $table = $this->resolveDatabaseTable();
            if (!Schema::hasTable($table)) {
                return null;
            }

            $idColumn = $this->resolveExistingColumn($table, ["id", "provider_id", "providerId"]);
            if ($idColumn === null) {
                return null;
            }

            $slotsColumn = $this->resolveExistingColumn(
                $table,
                ["availability_slots", "availability_json", "slots_json", "slots"]
            );
            $timezoneColumn = $this->resolveExistingColumn(
                $table,
                ["availability_timezone", "timezone", "tz"]
            );

            $rowObject = DB::table($table)
                ->where($idColumn, $providerId)
                ->first();
            if ($rowObject === null) {
                return null;
            }

            $row = (array) $rowObject;
            $slots = $slotsColumn !== null
                ? $this->parseSlotsFromRow($row[$slotsColumn] ?? null)
                : [];
            if ($slots === []) {
                $slots = $this->defaultAvailabilitySlots();
            }

            $timezone = $timezoneColumn !== null
                ? $this->normalizeTimezone($this->asString($row[$timezoneColumn] ?? null))
                : self::DEFAULT_AVAILABILITY_TIMEZONE;

            return [
                "timezone" => $timezone,
                "slots" => $slots,
                "source" => "database",
                "revision" => $this->resolveAvailabilityRevision($providerId, $timezone, $slots),
            ];
        } catch (Throwable) {
            return null;
        }
    }

    private function persistAvailabilitySnapshot(
        int $providerId,
        string $timezone,
        array $slots
    ): string {
        if ($this->persistAvailabilityToDedicatedTable($providerId, $timezone, $slots)) {
            return "database";
        }
        if ($this->persistAvailabilityToProviderTable($providerId, $timezone, $slots)) {
            return "database";
        }

        return "in_memory";
    }

    private function persistAvailabilityToDedicatedTable(
        int $providerId,
        string $timezone,
        array $slots
    ): bool {
        try {
            if (!Schema::hasTable(self::AVAILABILITY_TABLE)) {
                return false;
            }

            $idColumn = $this->resolveExistingColumn(self::AVAILABILITY_TABLE, ["provider_id", "id"]);
            $slotsColumn = $this->resolveExistingColumn(
                self::AVAILABILITY_TABLE,
                ["slots_json", "slots", "availability_slots", "availability_json"]
            );
            if ($idColumn === null || $slotsColumn === null) {
                return false;
            }

            $timezoneColumn = $this->resolveExistingColumn(
                self::AVAILABILITY_TABLE,
                ["timezone", "availability_timezone", "tz"]
            );

            $payload = [
                $slotsColumn => json_encode($slots, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];
            if ($timezoneColumn !== null) {
                $payload[$timezoneColumn] = $timezone;
            }
            if (Schema::hasColumn(self::AVAILABILITY_TABLE, "updated_at")) {
                $payload["updated_at"] = now();
            }
            if (Schema::hasColumn(self::AVAILABILITY_TABLE, "created_at")) {
                $payload["created_at"] = now();
            }

            DB::table(self::AVAILABILITY_TABLE)->updateOrInsert(
                [$idColumn => $providerId],
                $payload
            );

            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private function persistAvailabilityToProviderTable(
        int $providerId,
        string $timezone,
        array $slots
    ): bool {
        try {
            $table = $this->resolveDatabaseTable();
            if (!Schema::hasTable($table)) {
                return false;
            }

            $idColumn = $this->resolveExistingColumn($table, ["id", "provider_id", "providerId"]);
            $slotsColumn = $this->resolveExistingColumn(
                $table,
                ["availability_slots", "availability_json", "slots_json", "slots"]
            );
            if ($idColumn === null || $slotsColumn === null) {
                return false;
            }

            $query = DB::table($table)->where($idColumn, $providerId);
            if (!$query->exists()) {
                return false;
            }

            $payload = [
                $slotsColumn => json_encode($slots, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];
            $timezoneColumn = $this->resolveExistingColumn(
                $table,
                ["availability_timezone", "timezone", "tz"]
            );
            if ($timezoneColumn !== null) {
                $payload[$timezoneColumn] = $timezone;
            }
            if (Schema::hasColumn($table, "updated_at")) {
                $payload["updated_at"] = now();
            }

            $query->update($payload);
            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private function resolveDatabaseTable(): string
    {
        $configured = trim((string) env("KC_PROVIDER_TABLE", self::DEFAULT_PROVIDER_TABLE));
        if ($configured !== "") {
            return $configured;
        }

        if (Schema::hasTable(self::DEFAULT_PROVIDER_TABLE)) {
            return self::DEFAULT_PROVIDER_TABLE;
        }
        if (Schema::hasTable(self::FALLBACK_PROVIDER_TABLE)) {
            return self::FALLBACK_PROVIDER_TABLE;
        }

        return self::DEFAULT_PROVIDER_TABLE;
    }

    private function resolveDataSourceMode(): string
    {
        $configured = strtolower(trim((string) env("KC_PROVIDER_DATA_SOURCE", self::DATA_SOURCE_AUTO)));
        if (in_array($configured, [self::DATA_SOURCE_AUTO, self::DATA_SOURCE_DATABASE, self::DATA_SOURCE_SEED], true)) {
            return $configured;
        }

        return self::DATA_SOURCE_AUTO;
    }

    private function resolveExistingColumn(string $table, array $candidates): ?string
    {
        foreach ($candidates as $candidate) {
            if (Schema::hasColumn($table, $candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    private function parseSlotsFromRow(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (!is_array($decoded)) {
                return [];
            }
            $value = $decoded;
        }

        return $this->normalizeAvailabilitySlots($value);
    }

    private function normalizeAvailabilitySlots(mixed $slots): array
    {
        if (!is_array($slots)) {
            return [];
        }

        $normalized = [];
        foreach ($slots as $slot) {
            if (!is_array($slot)) {
                continue;
            }

            $day = strtolower(trim((string) ($slot["day"] ?? "")));
            $start = trim((string) ($slot["start"] ?? ""));
            $end = trim((string) ($slot["end"] ?? ""));
            $enabledRaw = $slot["enabled"] ?? true;

            if (!in_array($day, self::WEEK_DAYS, true)) {
                continue;
            }
            if (!preg_match('/^\d{2}:\d{2}$/', $start) || !preg_match('/^\d{2}:\d{2}$/', $end)) {
                continue;
            }
            if (strcmp($start, $end) >= 0) {
                continue;
            }

            $enabled = filter_var($enabledRaw, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            $normalized[] = [
                "day" => $day,
                "start" => $start,
                "end" => $end,
                "enabled" => $enabled ?? true,
            ];
        }

        if ($normalized === []) {
            return [];
        }

        $order = array_flip(self::WEEK_DAYS);
        usort(
            $normalized,
            static function (array $left, array $right) use ($order): int {
                $leftOrder = $order[$left["day"]] ?? PHP_INT_MAX;
                $rightOrder = $order[$right["day"]] ?? PHP_INT_MAX;
                if ($leftOrder !== $rightOrder) {
                    return $leftOrder <=> $rightOrder;
                }

                return strcmp((string) $left["start"], (string) $right["start"]);
            }
        );

        return array_values($normalized);
    }

    private function normalizeTimezone(?string $timezone): string
    {
        $candidate = trim((string) $timezone);
        return $candidate !== "" ? $candidate : self::DEFAULT_AVAILABILITY_TIMEZONE;
    }

    private function resolveAvailabilityRevision(int $providerId, string $timezone, array $slots): int
    {
        if (isset(self::$availabilityRevisions[$providerId])) {
            return self::$availabilityRevisions[$providerId];
        }

        $fingerprint = json_encode(
            [
                "provider_id" => $providerId,
                "timezone" => $timezone,
                "slots" => $slots,
            ],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        $seed = (int) sprintf("%u", crc32((string) $fingerprint));
        $resolved = max(1, $seed % 1000000);
        self::$availabilityRevisions[$providerId] = $resolved;

        return $resolved;
    }

    private function defaultAvailabilitySlots(): array
    {
        return [
            ["day" => "mon", "start" => "08:00", "end" => "12:00", "enabled" => true],
            ["day" => "tue", "start" => "08:00", "end" => "12:00", "enabled" => true],
            ["day" => "wed", "start" => "08:00", "end" => "12:00", "enabled" => true],
            ["day" => "thu", "start" => "08:00", "end" => "12:00", "enabled" => true],
            ["day" => "fri", "start" => "08:00", "end" => "12:00", "enabled" => true],
            ["day" => "sat", "start" => "09:00", "end" => "13:00", "enabled" => true],
        ];
    }

    private function mapDatabaseRow(array $row): ?array
    {
        $id = $this->asInt(
            $this->pickFirst(
                $row,
                ["id", "provider_id", "providerId"]
            )
        );
        if ($id === null) {
            return null;
        }

        $name = $this->asString(
            $this->pickFirst(
                $row,
                ["name", "provider_name", "display_name", "company_name"]
            )
        );

        $role = $this->asString(
            $this->pickFirst(
                $row,
                ["role", "provider_role", "type"]
            )
        );

        $rawStatus = $this->pickFirst(
            $row,
            ["status", "state", "is_active", "active"]
        );
        $status = $this->normalizeStatus($rawStatus);

        $rating = $this->asFloat(
            $this->pickFirst(
                $row,
                ["rating", "avg_rating", "score"]
            )
        );

        return [
            "id" => $id,
            "name" => $name !== null && $name !== "" ? $name : "Provider {$id}",
            "role" => $role !== null && $role !== "" ? $role : "service_provider",
            "status" => $status,
            "category" => $this->asString($this->pickFirst($row, ["category", "service_category"])),
            "city" => $this->asString($this->pickFirst($row, ["city", "location_city"])),
            "rating" => $rating,
        ];
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
            return $value ? "active" : "inactive";
        }
        if (is_numeric($value)) {
            return ((int) $value) > 0 ? "active" : "inactive";
        }

        $text = strtolower(trim((string) $value));
        if ($text === "") {
            return "active";
        }
        if (in_array($text, ["1", "true", "enabled", "active"], true)) {
            return "active";
        }
        if (in_array($text, ["0", "false", "disabled", "inactive"], true)) {
            return "inactive";
        }

        return $text;
    }

    /**
     * Seed dataset used when DB table is unavailable.
     */
    private function seedRows(): array
    {
        return [
            [
                "id" => 1,
                "name" => "CleanHome Pro",
                "role" => "service_provider",
                "status" => "active",
                "category" => "Cleaning",
                "city" => "Madrid",
                "rating" => 4.8,
            ],
            [
                "id" => 2,
                "name" => "FixIt Now",
                "role" => "service_provider",
                "status" => "inactive",
                "category" => "Repairs",
                "city" => "Barcelona",
                "rating" => 4.5,
            ],
            [
                "id" => 3,
                "name" => "GreenGarden",
                "role" => "service_provider",
                "status" => "active",
                "category" => "Gardening",
                "city" => "Valencia",
                "rating" => 4.7,
            ],
        ];
    }
}
