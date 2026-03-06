<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class PropertyService
{
    private const DEFAULT_PROPERTY_TABLE = "properties";
    private const FALLBACK_PROPERTY_TABLE = "real_estate_properties";
    private const DATA_SOURCE_AUTO = "auto";
    private const DATA_SOURCE_DATABASE = "database";
    private const DATA_SOURCE_SEED = "seed";
    private const MAX_DB_ROWS = 500;

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
                    return true;
                }
            )
        );

        return [
            "data" => $filtered,
            "meta" => [
                "count" => count($filtered),
                "filters" => [
                    "status" => $filters["status"] ?? null,
                    "city" => $filters["city"] ?? null,
                    "manager_id" => $filters["manager_id"] ?? null,
                ],
                "source" => $dataset["source"],
            ],
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
     * Load property rows from database first, with in-memory fallback.
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

        $price = $this->asFloat(
            $this->pickFirst(
                $row,
                ["price", "list_price", "rent_price", "amount"]
            )
        );

        return [
            "id" => $id,
            "title" => $title !== null && $title !== "" ? $title : "Property {$id}",
            "city" => $city !== null && $city !== "" ? $city : "Unknown",
            "status" => $status,
            "manager_id" => $managerId,
            "price" => $price,
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
        return [
            [
                "id" => 101,
                "title" => "Modern Loft Center",
                "city" => "Madrid",
                "status" => "available",
                "manager_id" => "mgr-001",
                "price" => 235000,
            ],
            [
                "id" => 102,
                "title" => "Family Home North",
                "city" => "Barcelona",
                "status" => "reserved",
                "manager_id" => "mgr-001",
                "price" => 310000,
            ],
            [
                "id" => 103,
                "title" => "City Apartment East",
                "city" => "Valencia",
                "status" => "available",
                "manager_id" => "mgr-002",
                "price" => 198000,
            ],
        ];
    }
}
