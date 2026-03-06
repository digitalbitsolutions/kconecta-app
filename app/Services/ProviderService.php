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
        $rows = [
            [
                "id" => 1,
                "name" => "CleanHome Pro",
                "role" => "service_provider",
                "status" => "active",
            ],
            [
                "id" => 2,
                "name" => "FixIt Now",
                "role" => "service_provider",
                "status" => "inactive",
            ],
        ];

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
}
