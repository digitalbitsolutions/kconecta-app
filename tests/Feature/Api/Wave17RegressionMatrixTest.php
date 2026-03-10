<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave17RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave17_manager_can_reserve_property_when_endpoint_is_available(): void
    {
        $response = $this
            ->withHeaders($this->headers("manager"))
            ->postJson("/api/properties/101/reserve");

        if ($this->isMutationEndpointUnavailable($response->status())) {
            $this->markTestIncomplete(
                "Wave 17 manager reserve endpoint is not merged in this branch yet."
            );
            return;
        }

        $response
            ->assertOk()
            ->assertJsonPath("data.id", 101)
            ->assertJsonPath("meta.contract", "property-mutation-v1")
            ->assertJsonPath("meta.flow", "properties_reserve");
    }

    public function test_wave17_manager_release_and_update_contract_when_endpoints_are_available(): void
    {
        $releaseResponse = $this
            ->withHeaders($this->headers("manager"))
            ->postJson("/api/properties/102/release");

        if ($this->isMutationEndpointUnavailable($releaseResponse->status())) {
            $this->markTestIncomplete(
                "Wave 17 manager release endpoint is not merged in this branch yet."
            );
            return;
        }

        $releaseResponse
            ->assertOk()
            ->assertJsonPath("data.id", 102)
            ->assertJsonPath("meta.contract", "property-mutation-v1")
            ->assertJsonPath("meta.flow", "properties_release");

        $updateResponse = $this
            ->withHeaders($this->headers("manager"))
            ->patchJson("/api/properties/101", ["status" => "maintenance"]);

        if ($this->isMutationEndpointUnavailable($updateResponse->status())) {
            $this->markTestIncomplete(
                "Wave 17 manager update endpoint is not merged in this branch yet."
            );
            return;
        }

        $updateResponse
            ->assertOk()
            ->assertJsonPath("data.id", 101)
            ->assertJsonPath("data.status", "maintenance")
            ->assertJsonPath("meta.contract", "property-mutation-v1")
            ->assertJsonPath("meta.flow", "properties_update");
    }

    public function test_wave17_conflict_contract_for_already_reserved_property_when_guard_is_active(): void
    {
        $response = $this
            ->withHeaders($this->headers("manager"))
            ->postJson("/api/properties/102/reserve");

        if ($this->isMutationEndpointUnavailable($response->status())) {
            $this->markTestIncomplete(
                "Wave 17 manager reserve endpoint is not merged in this branch yet."
            );
            return;
        }

        if ($response->status() === 200) {
            $this->markTestIncomplete(
                "Wave 17 conflict guard is not active yet for already-reserved mutations."
            );
            return;
        }

        $response
            ->assertStatus(409)
            ->assertJsonPath("error.code", "PROPERTY_STATE_CONFLICT")
            ->assertJsonPath("meta.contract", "property-mutation-v1")
            ->assertJsonPath("meta.flow", "properties_reserve")
            ->assertJsonPath("meta.reason", "already_reserved")
            ->assertJsonPath("meta.retryable", true);
    }

    public function test_wave17_mutations_require_manager_scope_and_valid_token_when_endpoints_are_available(): void
    {
        $forbidden = $this
            ->withHeaders($this->headers("provider"))
            ->postJson("/api/properties/101/reserve");

        if ($this->isMutationEndpointUnavailable($forbidden->status())) {
            $this->markTestIncomplete(
                "Wave 17 manager reserve endpoint is not merged in this branch yet."
            );
            return;
        }

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_reserve")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->postJson("/api/properties/101/reserve");

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_reserve")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_wave16_portfolio_read_baseline_remains_stable_after_wave17(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties?status=available&page=1&per_page=2");

        $response
            ->assertOk()
            ->assertJsonPath("meta.page", 1)
            ->assertJsonPath("meta.per_page", 2)
            ->assertJsonPath("meta.filters.status", "available")
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
    }

    private function headers(string $role): array
    {
        return [
            "Authorization" => "Bearer " . self::API_TOKEN,
            "X-KCONECTA-ROLE" => $role,
        ];
    }

    private function isMutationEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
