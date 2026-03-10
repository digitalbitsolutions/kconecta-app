<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave16RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave16_manager_login_returns_manager_session_contract(): void
    {
        $response = $this->postJson("/api/auth/login", [
            "email" => "manager@kconecta.local",
            "password" => "kconecta-dev-password",
        ]);

        $response
            ->assertOk()
            ->assertJsonPath("data.role", "manager")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonStructure([
                "data" => [
                    "access_token",
                    "refresh_token",
                    "token_type",
                    "expires_in",
                    "scope",
                    "role",
                    "issued_at",
                ],
                "meta" => ["contract", "mode"],
            ]);

        $this->assertContains("properties:*", (array) $response->json("data.scope"));
        $this->assertContains("dashboard:read", (array) $response->json("data.scope"));
    }

    public function test_wave16_manager_access_token_can_fetch_portfolio_contract(): void
    {
        $token = $this->issueManagerAccessToken();

        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . $token])
            ->getJson("/api/properties?search=Modern&page=1&per_page=2");

        $response
            ->assertOk()
            ->assertJsonPath("meta.page", 1)
            ->assertJsonPath("meta.per_page", 2)
            ->assertJsonPath("meta.filters.search", "Modern")
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

        $this->assertGreaterThanOrEqual(0, (int) $response->json("meta.kpis.active_properties"));
        $this->assertGreaterThanOrEqual(0, (int) $response->json("meta.kpis.reserved_properties"));
    }

    public function test_wave16_properties_reject_invalid_pagination_with_validation_errors(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties?page=0&per_page=101");

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(["page", "per_page"]);
    }

    public function test_wave14_and_wave15_provider_baseline_remains_stable_after_wave16_changes(): void
    {
        $availabilityResponse = $this
            ->withHeaders($this->providerHeaders(1))
            ->getJson("/api/providers/1/availability");

        $availabilityResponse
            ->assertOk()
            ->assertJsonPath("data.provider_id", 1)
            ->assertJsonPath("meta.contract", "provider-availability-v1")
            ->assertJsonStructure([
                "data" => [
                    "provider_id",
                    "revision",
                    "timezone",
                    "slots" => [
                        "*" => ["day", "start", "end", "enabled"],
                    ],
                ],
                "meta" => ["contract", "source"],
            ]);

        $currentRevision = (int) $availabilityResponse->json("data.revision");
        $this->assertGreaterThan(0, $currentRevision);

        $conflictResponse = $this
            ->withHeaders($this->providerHeaders(1))
            ->patchJson("/api/providers/1/availability", [
                "revision" => $currentRevision + 1,
                "timezone" => "Europe/Madrid",
                "slots" => [
                    [
                        "day" => "mon",
                        "start" => "08:00",
                        "end" => "12:00",
                        "enabled" => true,
                    ],
                ],
            ]);

        $conflictResponse
            ->assertStatus(409)
            ->assertJsonPath("error.code", "AVAILABILITY_REVISION_CONFLICT")
            ->assertJsonPath("meta.contract", "provider-availability-v1")
            ->assertJsonPath("meta.reason", "revision_conflict")
            ->assertJsonPath("meta.flow", "providers_availability_update")
            ->assertJsonPath("data.provider_id", 1)
            ->assertJsonPath("data.revision", $currentRevision);
    }

    private function issueManagerAccessToken(): string
    {
        $response = $this->postJson("/api/auth/login", [
            "email" => "manager@kconecta.local",
            "password" => "kconecta-dev-password",
        ]);

        $response->assertOk();

        return (string) $response->json("data.access_token");
    }

    private function providerHeaders(int $providerId): array
    {
        return [
            "Authorization" => "Bearer " . self::API_TOKEN,
            "X-KCONECTA-ROLE" => "provider",
            "X-KCONECTA-PROVIDER-ID" => (string) $providerId,
        ];
    }
}
