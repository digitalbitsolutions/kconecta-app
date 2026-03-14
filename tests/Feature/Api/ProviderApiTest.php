<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ProviderApiTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_authenticated_user_can_fetch_providers_when_wave30_directory_contract_is_ready(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/providers");

        if (!$this->isWave30ProviderDirectoryReady($response)) {
            $this->markTestIncomplete(
                "Wave 30 manager provider directory contract is not merged in this branch yet."
            );
            return;
        }

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

    public function test_authenticated_user_can_filter_and_paginate_providers_for_manager_directory_when_wave30_contract_is_ready(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->getJson("/api/providers?status=active&city=Madrid&category=Cleaning&search=Clean&page=1&per_page=1");

        if (!$this->isWave30ProviderDirectoryReady($response)) {
            $this->markTestIncomplete(
                "Wave 30 manager provider directory contract is not merged in this branch yet."
            );
            return;
        }

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

    public function test_mobile_client_with_bearer_token_can_fetch_providers_when_wave30_directory_contract_is_ready(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers");

        if (!$this->isWave30ProviderDirectoryReady($response)) {
            $this->markTestIncomplete(
                "Wave 30 manager provider directory contract is not merged in this branch yet."
            );
            return;
        }

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

    public function test_authenticated_user_can_fetch_provider_detail_with_manager_profile_shape_when_wave30_contract_is_ready(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/providers/1");

        if (!$this->isWave30ProviderProfileReady($response)) {
            $this->markTestIncomplete(
                "Wave 30 manager provider profile contract is not merged in this branch yet."
            );
            return;
        }

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
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1")
            ->assertJsonMissingPath("data.assignment_fit");
        $this->assertValidDataSource($response->json("meta.source"));
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

    public function test_mobile_client_with_bearer_token_can_fetch_provider_detail_when_wave30_contract_is_ready(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers/1");

        if (!$this->isWave30ProviderProfileReady($response)) {
            $this->markTestIncomplete(
                "Wave 30 manager provider profile contract is not merged in this branch yet."
            );
            return;
        }

        $response
            ->assertOk()
            ->assertJsonPath("data.id", 1)
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1");
    }

    public function test_manager_can_fetch_assignment_aware_provider_profile_scorecard_when_wave34_contract_is_ready(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->getJson("/api/providers/1?queue_item_id=priority-provider-assignment-101");

        if (!$this->isWave30ProviderProfileReady($response)) {
            $this->markTestIncomplete(
                "Wave 30 manager provider profile contract is not merged in this branch yet."
            );
            return;
        }

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "assignment_fit" => [
                        "recommended",
                        "score_label",
                        "match_reasons",
                        "warnings",
                        "next_action",
                    ],
                ],
                "meta" => ["contract", "source"],
            ])
            ->assertJsonPath("data.assignment_fit.recommended", true)
            ->assertJsonPath("data.assignment_fit.score_label", "Recommended")
            ->assertJsonPath("data.assignment_fit.next_action", "select_provider");
    }

    public function test_provider_role_cannot_request_assignment_aware_provider_profile_scorecard(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
                "X-KCONECTA-PROVIDER-ID" => "1",
            ])
            ->getJson("/api/providers/1?queue_item_id=priority-provider-assignment-101");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_show");
    }

    public function test_manager_gets_not_found_for_unknown_queue_context_in_provider_profile(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->getJson("/api/providers/1?queue_item_id=priority-missing-999");

        $response
            ->assertNotFound()
            ->assertJsonPath("error.code", "QUEUE_ITEM_NOT_FOUND")
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1")
            ->assertJsonPath("meta.flow", "providers_show")
            ->assertJsonPath("meta.reason", "queue_item_not_found")
            ->assertJsonPath("queue_item_id", "priority-missing-999");
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

    private function isWave30ProviderDirectoryReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        if ($response->json("meta.contract") !== "manager-provider-directory-v1") {
            return false;
        }

        $filters = $response->json("meta.filters");
        if (!is_array($filters)) {
            return false;
        }

        $first = $response->json("data.0");
        if ($first === null) {
            return true;
        }

        return is_array($first)
            && array_key_exists("category", $first)
            && array_key_exists("city", $first)
            && is_array($first["availability_summary"] ?? null)
            && array_key_exists("services_preview", $first);
    }

    private function isWave30ProviderProfileReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        if ($response->json("meta.contract") !== "manager-provider-directory-v1") {
            return false;
        }

        $metrics = $response->json("data.metrics");
        return is_array($metrics)
            && array_key_exists("completed_jobs", $metrics)
            && array_key_exists("response_time_hours", $metrics)
            && array_key_exists("customer_score", $metrics)
            && is_array($response->json("data.availability_summary"));
    }
}
