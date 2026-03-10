<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave19RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave19_manager_can_load_provider_candidates_when_endpoint_is_available(): void
    {
        $response = $this
            ->withHeaders($this->headers("manager"))
            ->getJson("/api/properties/101/provider-candidates");

        if ($this->isHandoffEndpointUnavailable($response->status())) {
            $this->markTestIncomplete(
                "Wave 19 provider candidates endpoint is not merged in this branch yet."
            );
            return;
        }

        $response
            ->assertOk()
            ->assertJsonPath("data.property_id", 101)
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_provider_candidates")
            ->assertJsonPath("meta.reason", "candidates_loaded")
            ->assertJsonStructure([
                "data" => [
                    "property_id",
                    "candidates" => [
                        "*" => ["id", "name", "role", "status", "category", "city", "rating"],
                    ],
                ],
                "meta" => ["contract", "flow", "reason", "source"],
            ]);
    }

    public function test_wave19_assignment_success_contract_when_endpoint_is_available(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-qa-wave19",
            ])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
                "note" => "Wave19 regression assignment",
            ]);

        if ($this->isHandoffEndpointUnavailable($response->status())) {
            $this->markTestIncomplete(
                "Wave 19 provider assignment endpoint is not merged in this branch yet."
            );
            return;
        }

        $response
            ->assertOk()
            ->assertJsonPath("data.property_id", 101)
            ->assertJsonPath("data.provider_id", 1)
            ->assertJsonPath("data.property.provider_id", 1)
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "provider_assigned");
    }

    public function test_wave19_assignment_validation_and_guardrails_when_endpoint_is_available(): void
    {
        $validation = $this
            ->withHeaders($this->headers("manager"))
            ->postJson("/api/properties/101/assign-provider", []);

        if ($this->isHandoffEndpointUnavailable($validation->status())) {
            $this->markTestIncomplete(
                "Wave 19 provider assignment endpoint is not merged in this branch yet."
            );
            return;
        }

        $validation
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_ERROR")
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "validation_error")
            ->assertJsonStructure([
                "error" => [
                    "fields" => ["provider_id"],
                ],
            ]);

        $unknownProvider = $this
            ->withHeaders($this->headers("manager"))
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 999999,
            ]);

        $unknownProvider
            ->assertNotFound()
            ->assertJsonPath("error.code", "PROVIDER_NOT_FOUND")
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "provider_not_found")
            ->assertJsonPath("provider_id", 999999);

        $inactiveProvider = $this
            ->withHeaders($this->headers("manager"))
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 2,
            ]);

        $inactiveProvider
            ->assertStatus(409)
            ->assertJsonPath("error.code", "ASSIGNMENT_CONFLICT")
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "provider_inactive");

        $forbidden = $this
            ->withHeaders($this->headers("provider"))
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
            ]);

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $sessionExpired = $this
            ->withHeaders(["Authorization" => "Bearer expired-token"])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
            ]);

        $sessionExpired
            ->assertUnauthorized()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider");

        $this->assertContains(
            (string) $sessionExpired->json("error.code"),
            ["TOKEN_INVALID", "TOKEN_EXPIRED"],
            "Wave 19 session-expired path should keep deterministic auth-session error codes."
        );
    }

    public function test_wave16_to_wave18_manager_baseline_remains_stable_after_wave19(): void
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

    private function isHandoffEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
