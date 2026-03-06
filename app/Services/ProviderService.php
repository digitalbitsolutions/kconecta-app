<?php

namespace App\Services;

class ProviderService
{
    /**
     * Returns a provider list payload.
     * This skeleton keeps logic isolated from the controller and is ready
     * to be replaced by repository/Eloquent-backed query code.
     */
    public function listProviders(array $filters = []): array
    {
        $rows = $this->seedRows();

        $filtered = array_values(
            array_filter(
                $rows,
                static function (array $item) use ($filters): bool {
                    if (!empty($filters["role"]) && $item["role"] !== $filters["role"]) {
                        return false;
                    }
                    if (!empty($filters["status"]) && $item["status"] !== $filters["status"]) {
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
            ],
        ];
    }

    public function findProviderById(int $id): ?array
    {
        foreach ($this->seedRows() as $row) {
            if ((int) $row["id"] === $id) {
                return $row;
            }
        }

        return null;
    }

    /**
     * Temporary in-memory provider dataset until DB-backed repository is added.
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
