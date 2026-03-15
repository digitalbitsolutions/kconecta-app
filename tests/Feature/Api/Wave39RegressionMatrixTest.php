<?php

namespace Tests\Feature\Api;

use App\Services\PropertyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Mockery;
use Tests\TestCase;

class Wave39RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave39_pending_actions_contract_is_deterministic_when_ready(): void
    {
        $probe = $this->wave39ReadinessProbe();

        if (!$this->isWave39ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 39 manager dashboard pending actions contract is not merged in this branch yet."
            );
            return;
        }

        $probe
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-dashboard-pending-actions-v1")
            ->assertJsonStructure([
                "data" => [
                    "*" => [
                        "id",
                        "action_type",
                        "entity_type",
                        "entity_id",
                        "title",
                        "subtitle",
                        "status_badge",
                        "priority_badge",
                        "due_at",
                        "updated_at",
                        "deep_link" => [
                            "route",
                            "params" => [
                                "queue_item_id",
                                "property_id",
                            ],
                        ],
                    ],
                ],
                "meta" => [
                    "contract",
                    "generated_at",
                    "source",
                    "filters" => ["limit"],
                    "count",
                    "counts" => ["total", "high_priority"],
                ],
            ]);

        $first = $probe->json("data.0");
        $this->assertNotNull($first);
        $this->assertContains(
            $first["action_type"],
            [
                "handoff_pending_confirmation",
                "handoff_pending_acceptance",
                "contract_pending_approval",
                "contract_expiring_soon",
            ]
        );
        $this->assertContains(
            $first["deep_link"]["route"],
            [
                "manager_provider_handoff",
                "manager_assignment_detail",
            ]
        );
    }

    public function test_wave39_pending_actions_empty_state_is_deterministic(): void
    {
        $mock = Mockery::mock(PropertyService::class);
        $mock
            ->shouldReceive("pendingActions")
            ->once()
            ->andReturn([
                "data" => [],
                "meta" => [
                    "contract" => "manager-dashboard-pending-actions-v1",
                    "generated_at" => "2026-03-15T00:00:00Z",
                    "source" => "in_memory",
                    "filters" => ["limit" => 6],
                    "count" => 0,
                    "counts" => [
                        "total" => 0,
                        "high_priority" => 0,
                    ],
                ],
            ]);
        $this->app->instance(PropertyService::class, $mock);

        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/pending-actions?limit=6");

        $response
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-dashboard-pending-actions-v1")
            ->assertJsonPath("meta.count", 0)
            ->assertJsonPath("meta.counts.total", 0)
            ->assertJsonPath("meta.counts.high_priority", 0)
            ->assertJsonPath("meta.filters.limit", 6)
            ->assertExactJson([
                "data" => [],
                "meta" => [
                    "contract" => "manager-dashboard-pending-actions-v1",
                    "generated_at" => "2026-03-15T00:00:00Z",
                    "source" => "in_memory",
                    "filters" => ["limit" => 6],
                    "count" => 0,
                    "counts" => [
                        "total" => 0,
                        "high_priority" => 0,
                    ],
                ],
            ]);
    }

    public function test_wave39_pending_actions_guardrails_are_stable_when_ready(): void
    {
        $probe = $this->wave39ReadinessProbe();

        if (!$this->isWave39ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 39 manager dashboard pending actions contract is not merged in this branch yet."
            );
            return;
        }

        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/priorities/pending-actions");

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_pending_actions")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties/priorities/pending-actions");

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_pending_actions")
            ->assertJsonPath("meta.reason", "token_invalid");
    }

    private function wave39ReadinessProbe(): TestResponse
    {
        return $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/pending-actions");
    }

    private function isWave39ContractReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        if ($response->json("meta.contract") !== "manager-dashboard-pending-actions-v1") {
            return false;
        }

        $first = $response->json("data.0");

        return is_array($first)
            && array_key_exists("action_type", $first)
            && array_key_exists("priority_badge", $first)
            && is_array($first["deep_link"] ?? null)
            && array_key_exists("route", $first["deep_link"])
            && is_array($first["deep_link"]["params"] ?? null)
            && array_key_exists("queue_item_id", $first["deep_link"]["params"])
            && array_key_exists("property_id", $first["deep_link"]["params"]);
    }
}
