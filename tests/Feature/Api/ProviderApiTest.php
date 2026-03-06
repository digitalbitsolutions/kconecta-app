<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProviderApiTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_authenticated_user_can_fetch_providers(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/providers");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "*" => ["id", "name", "role", "status"],
                ],
                "meta" => ["count", "filters" => ["role", "status"], "source"],
            ]);
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_authenticated_user_can_filter_providers_by_status(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/providers?status=active");

        $response
            ->assertOk()
            ->assertJsonPath("meta.filters.status", "active");
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_mobile_client_with_bearer_token_can_fetch_providers(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "*" => ["id", "name", "role", "status"],
                ],
                "meta" => ["count", "filters" => ["role", "status"], "source"],
            ]);
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_authenticated_user_can_fetch_provider_detail(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/providers/1");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => ["id", "name", "role", "status"],
            ])
            ->assertJsonPath("data.id", 1);
    }

    public function test_authenticated_user_gets_not_found_for_unknown_provider(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/providers/999999");

        $response
            ->assertNotFound()
            ->assertJsonPath("message", "Provider not found")
            ->assertJsonPath("provider_id", 999999);
    }

    public function test_mobile_client_with_bearer_token_can_fetch_provider_detail(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers/1");

        $response
            ->assertOk()
            ->assertJsonPath("data.id", 1);
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
