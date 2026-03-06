<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class ProviderService
{
    private const DEFAULT_PROVIDER_TABLE = "providers";
    private const FALLBACK_PROVIDER_TABLE = "service_providers";
    private const DATA_SOURCE_AUTO = "auto";
    private const DATA_SOURCE_DATABASE = "database";
    private const DATA_SOURCE_SEED = "seed";
    private const MAX_DB_ROWS = 500;

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
