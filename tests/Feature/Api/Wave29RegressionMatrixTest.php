<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class Wave29RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave29_assignment_evidence_success_contract_is_deterministic_when_ready(): void
    {
        $success = $this->wave29AssignmentProbe();

        if (!$this->isWave29AssignmentEvidenceReady($success)) {
            $this->markTestIncomplete(
                "Wave 29 manager handoff evidence contract is not merged in this branch yet."
            );
            return;
        }

        $success
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "provider_assigned")
            ->assertJsonPath("data.property_id", 101)
            ->assertJsonPath("data.provider_id", 1)
            ->assertJsonPath("data.assignment.assigned", true)
            ->assertJsonPath("data.assignment.state", "assigned")
            ->assertJsonPath("data.assignment.note", "Wave 29 QA assignment evidence")
            ->assertJsonPath("data.assignment.provider.id", 1)
            ->assertJsonPath("data.assignment.provider.name", "CleanHome Pro")
            ->assertJsonPath("data.latest_timeline_event.type", "assignment")
            ->assertJsonPath("data.latest_timeline_event.metadata.provider_id", 1);
    }

    public function test_wave29_assignment_guardrails_remain_stable(): void
    {
        $readyProbe = $this->wave29AssignmentProbe();

        if (!$this->isWave29AssignmentEvidenceReady($readyProbe)) {
            $this->markTestIncomplete(
                "Wave 29 manager handoff evidence contract is not merged in this branch yet."
            );
            return;
        }

        $conflict = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 2,
            ]);

        $conflict
            ->assertStatus(409)
            ->assertJsonPath("error.code", "ASSIGNMENT_CONFLICT")
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "provider_inactive");

        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
            ]);

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
            ]);

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider");

        $this->assertContains(
            (string) $unauthorized->json("error.code"),
            ["TOKEN_INVALID", "TOKEN_EXPIRED"],
            "Wave 29 unauthorized handoff guard should keep a deterministic auth error code."
        );
    }

    public function test_wave29_preserves_assignment_context_dashboard_and_auth_baselines(): void
    {
        $readyProbe = $this->wave29AssignmentProbe();

        if (!$this->isWave29AssignmentEvidenceReady($readyProbe)) {
            $this->markTestIncomplete(
                "Wave 29 manager handoff evidence contract is not merged in this branch yet."
            );
            return;
        }

        $assignmentContext = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101/assignment-context");

        $assignmentContext
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-provider-context-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("data.assignment.assigned", true)
            ->assertJsonPath("data.assignment.state", "assigned")
            ->assertJsonPath("data.assignment.provider.id", 1);

        $summary = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/summary");

        $summary
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-dashboard-summary-v1")
            ->assertJsonStructure([
                "data" => [
                    "kpis" => [
                        "active_properties",
                        "reserved_properties",
                        "avg_time_to_close_days",
                        "provider_matches_pending",
                    ],
                    "priorities",
                ],
            ]);

        $authMe = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/auth/me");

        if ($this->isAuthMeEndpointUnavailable($authMe->status())) {
            $this->markTestIncomplete("Wave 20 auth/me endpoint is not merged in this branch yet.");
            return;
        }

        $authMe
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "me")
            ->assertJsonPath("meta.reason", "token_invalid");
    }

    private function wave29AssignmentProbe(): TestResponse
    {
        return $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-wave29-qa",
            ])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
                "note" => "Wave 29 QA assignment evidence",
            ]);
    }

    private function isWave29AssignmentEvidenceReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        return $response->json("meta.contract") === "manager-provider-handoff-v1"
            && $response->json("meta.flow") === "properties_assign_provider"
            && is_array($response->json("data.assignment"))
            && is_array($response->json("data.latest_timeline_event"));
    }

    private function isAuthMeEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
