<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave22RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave22_filter_combinations_expose_deterministic_meta_contract(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties?status=available&city=Madrid&search=Modern&page=1&per_page=1");

        $response
            ->assertOk()
            ->assertJsonPath("meta.page", 1)
            ->assertJsonPath("meta.per_page", 1)
            ->assertJsonPath("meta.total_pages", 1)
            ->assertJsonPath("meta.has_next_page", false)
            ->assertJsonPath("meta.filters.status", "available")
            ->assertJsonPath("meta.filters.city", "Madrid")
            ->assertJsonPath("meta.filters.search", "Modern")
            ->assertJsonStructure([
                "meta" => [
                    "count",
                    "page",
                    "per_page",
                    "total",
                    "total_pages",
                    "has_next_page",
                    "filters" => ["status", "city", "manager_id", "search"],
                    "source",
                ],
            ]);
    }

    public function test_wave22_empty_results_and_pagination_boundaries_are_stable(): void
    {
        $empty = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties?city=NonExistingCity&page=1&per_page=5");

        $empty
            ->assertOk()
            ->assertJsonPath("meta.count", 0)
            ->assertJsonPath("meta.total", 0)
            ->assertJsonPath("meta.total_pages", 0)
            ->assertJsonPath("meta.has_next_page", false)
            ->assertJsonPath("meta.filters.city", "NonExistingCity");

        $middlePage = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties?page=2&per_page=1");

        $middlePage
            ->assertOk()
            ->assertJsonPath("meta.page", 2)
            ->assertJsonPath("meta.per_page", 1)
            ->assertJsonPath("meta.total", 3)
            ->assertJsonPath("meta.total_pages", 3)
            ->assertJsonPath("meta.has_next_page", true);

        $lastPage = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties?page=3&per_page=1");

        $lastPage
            ->assertOk()
            ->assertJsonPath("meta.page", 3)
            ->assertJsonPath("meta.total_pages", 3)
            ->assertJsonPath("meta.has_next_page", false);
    }

    public function test_wave22_preserves_wave20_and_wave21_guardrails(): void
    {
        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/101/assignment-context");

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties");

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_index")
            ->assertJsonPath("meta.reason", "token_invalid");
    }
}

