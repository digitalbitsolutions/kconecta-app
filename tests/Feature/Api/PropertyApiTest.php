<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PropertyApiTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_authenticated_user_can_fetch_properties(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/properties");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "*" => ["id", "title", "city", "status", "manager_id", "price"],
                ],
                "meta" => [
                    "count",
                    "page",
                    "per_page",
                    "total",
                    "filters" => ["status", "city", "manager_id", "search"],
                    "kpis" => [
                        "active_properties",
                        "reserved_properties",
                        "avg_time_to_close_days",
                        "provider_matches_pending",
                    ],
                    "source",
                ],
            ]);
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_authenticated_user_can_filter_properties(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson(
            "/api/properties?status=available&city=Madrid&search=Modern&page=1&per_page=1"
        );

        $response
            ->assertOk()
            ->assertJsonPath("meta.filters.status", "available")
            ->assertJsonPath("meta.filters.city", "Madrid")
            ->assertJsonPath("meta.filters.search", "Modern")
            ->assertJsonPath("meta.page", 1)
            ->assertJsonPath("meta.per_page", 1)
            ->assertJsonPath("meta.count", 1);
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_authenticated_user_can_fetch_property_detail(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/properties/101");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => ["id", "title", "city", "status", "manager_id", "price"],
            ])
            ->assertJsonPath("data.id", 101);
    }

    public function test_authenticated_user_gets_not_found_for_unknown_property(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/properties/999999");

        $response
            ->assertNotFound()
            ->assertJsonPath("message", "Property not found")
            ->assertJsonPath("property_id", 999999);
    }

    public function test_mobile_client_with_bearer_token_can_fetch_properties(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "*" => ["id", "title", "city", "status", "manager_id", "price"],
                ],
                "meta" => [
                    "count",
                    "page",
                    "per_page",
                    "total",
                    "filters" => ["status", "city", "manager_id", "search"],
                    "kpis" => [
                        "active_properties",
                        "reserved_properties",
                        "avg_time_to_close_days",
                        "provider_matches_pending",
                    ],
                    "source",
                ],
            ]);
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_mobile_client_with_bearer_token_can_fetch_property_detail(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101");

        $response
            ->assertOk()
            ->assertJsonPath("data.id", 101);
    }

    public function test_properties_endpoint_returns_validation_errors_for_invalid_pagination(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties?page=0&per_page=500");

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(["page", "per_page"]);
    }

    public function test_provider_role_is_forbidden_from_manager_properties_endpoint(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN");
    }

    private function assertValidDataSource(mixed $source): void
    {
        $this->assertContains(
            $source,
            ["database", "in_memory"],
            "meta.source must be either database or in_memory."
        );
    }
}
