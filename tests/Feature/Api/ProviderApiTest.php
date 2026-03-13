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
                    "*" => [
                        "id",
                        "name",
                        "category",
                        "city",
                        "status",
                        "rating",
                        "availability_summary" => ["label", "next_open_slot"],
                        "services_preview",
                    ],
                ],
                "meta" => [
                    "contract",
                    "count",
                    "page",
                    "per_page",
                    "total",
                    "total_pages",
                    "has_next_page",
                    "filters" => ["role", "status", "category", "city", "search"],
                    "source",
                ],
            ])
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1");
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_authenticated_user_can_filter_and_paginate_providers_for_manager_directory(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->getJson("/api/providers?status=active&city=Madrid&category=Cleaning&search=Clean&page=1&per_page=1");

        $response
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1")
            ->assertJsonPath("meta.filters.status", "active")
            ->assertJsonPath("meta.filters.city", "Madrid")
            ->assertJsonPath("meta.filters.category", "Cleaning")
            ->assertJsonPath("meta.filters.search", "Clean")
            ->assertJsonPath("meta.page", 1)
            ->assertJsonPath("meta.per_page", 1)
            ->assertJsonCount(1, "data");
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
                    "*" => [
                        "id",
                        "name",
                        "category",
                        "city",
                        "status",
                        "rating",
                        "availability_summary" => ["label", "next_open_slot"],
                        "services_preview",
                    ],
                ],
                "meta" => [
                    "contract",
                    "count",
                    "page",
                    "per_page",
                    "total",
                    "total_pages",
                    "has_next_page",
                    "filters" => ["role", "status", "category", "city", "search"],
                    "source",
                ],
            ])
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1");
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_authenticated_user_can_fetch_provider_detail_with_manager_profile_shape(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/providers/1");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "id",
                    "name",
                    "category",
                    "city",
                    "status",
                    "rating",
                    "bio",
                    "phone",
                    "email",
                    "services",
                    "coverage",
                    "availability_summary" => ["label", "next_open_slot"],
                    "metrics" => ["completed_jobs", "response_time_hours", "customer_score"],
                ],
                "meta" => ["contract", "source"],
            ])
            ->assertJsonPath("data.id", 1)
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1");
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

    public function test_provider_directory_rejects_invalid_bearer_token_with_auth_contract(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/providers");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_index");
    }

    public function test_provider_detail_rejects_invalid_bearer_token_with_auth_contract(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/providers/1");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_show");
    }

    public function test_provider_directory_rejects_invalid_role_with_forbidden_contract(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "guest",
            ])
            ->getJson("/api/providers");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_index");
    }

    public function test_provider_detail_rejects_invalid_role_with_forbidden_contract(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "guest",
            ])
            ->getJson("/api/providers/1");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_show");
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
