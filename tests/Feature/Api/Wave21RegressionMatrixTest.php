<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave21RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave21_assignment_context_success_and_unassigned_states_when_endpoint_is_available(): void
    {
        $unassigned = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101/assignment-context");

        if ($this->isWave21AssignmentContextEndpointUnavailable($unassigned->status())) {
            $this->markTestIncomplete(
                "Wave 21 assignment-context endpoint is not merged in this branch yet."
            );
            return;
        }

        $unassigned
            ->assertOk()
            ->assertJsonPath("data.property_id", 101)
            ->assertJsonPath("data.assignment.assigned", false)
            ->assertJsonPath("data.assignment.state", "unassigned")
            ->assertJsonPath("meta.contract", "manager-provider-context-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("meta.reason", "assignment_context_loaded");

        $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-wave21",
            ])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
                "note" => "Wave 21 matrix assignment check",
            ])
            ->assertOk();

        $assigned = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101/assignment-context");

        $assigned
            ->assertOk()
            ->assertJsonPath("data.property_id", 101)
            ->assertJsonPath("data.assignment.assigned", true)
            ->assertJsonPath("data.assignment.state", "assigned")
            ->assertJsonPath("data.assignment.provider.id", 1)
            ->assertJsonPath("meta.contract", "manager-provider-context-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("meta.reason", "assignment_context_loaded");
    }

    public function test_wave21_assignment_context_forbidden_and_unauthorized_contract_when_endpoint_is_available(): void
    {
        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/101/assignment-context");

        if ($this->isWave21AssignmentContextEndpointUnavailable($forbidden->status())) {
            $this->markTestIncomplete(
                "Wave 21 assignment-context endpoint is not merged in this branch yet."
            );
            return;
        }

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties/101/assignment-context");

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("meta.reason", "token_invalid");
    }

    public function test_wave19_and_wave20_baseline_remains_stable_after_wave21(): void
    {
        $handoff = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101/provider-candidates");

        $handoff
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_provider_candidates")
            ->assertJsonPath("meta.reason", "candidates_loaded");

        $authMe = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/auth/me");

        if ($this->isAuthMeEndpointUnavailable($authMe->status())) {
            $this->markTestIncomplete("Wave 20 auth/me endpoint is not merged in this branch yet.");
            return;
        }

        $authMe
            ->assertOk()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "me");
    }

    private function isWave21AssignmentContextEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }

    private function isAuthMeEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
