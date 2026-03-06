<?php

namespace App\Services;

class PropertyService
{
    /**
     * Returns property list payload with filter metadata.
     */
    public function listProperties(array $filters = []): array
    {
        $rows = $this->seedRows();

        $filtered = array_values(
            array_filter(
                $rows,
                static function (array $item) use ($filters): bool {
                    if (!empty($filters["status"]) && $item["status"] !== $filters["status"]) {
                        return false;
                    }
                    if (!empty($filters["city"]) && strcasecmp($item["city"], (string) $filters["city"]) !== 0) {
                        return false;
                    }
                    if (!empty($filters["manager_id"]) && $item["manager_id"] !== $filters["manager_id"]) {
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
            ],
        ];
    }

    public function findPropertyById(int $id): ?array
    {
        foreach ($this->seedRows() as $row) {
            if ((int) $row["id"] === $id) {
                return $row;
            }
        }

        return null;
    }

    /**
     * Temporary in-memory dataset used until DB-backed repository is wired.
     */
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
