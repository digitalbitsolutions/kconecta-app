<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave24RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave24_dashboard_summary_contract_and_priority_ordering_are_deterministic(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/summary");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "kpis" => [
                        "active_properties",
                        "reserved_properties",
                        "avg_time_to_close_days",
                        "provider_matches_pending",
                    ],
                    "priorities" => [
                        "*" => [
                            "id",
                            "category",
                            "title",
                            "description",
                            "severity",
                            "due_at",
                            "updated_at",
                        ],
                    ],
                ],
                "meta" => ["contract", "generated_at", "source"],
            ])
            ->assertJsonPath("meta.contract", "manager-dashboard-summary-v1");

        $generatedAt = (string) $response->json("meta.generated_at", "");
        $this->assertNotSame("", trim($generatedAt));

        $priorities = $response->json("data.priorities", []);
        $this->assertIsArray($priorities);
        $this->assertNotEmpty($priorities);

        $severityOrder = [
            "high" => 0,
            "medium" => 1,
            "low" => 2,
        ];

        $expected = $priorities;
        usort(
            $expected,
            static function (array $left, array $right) use ($severityOrder): int {
                $leftSeverity = $severityOrder[strtolower((string) ($left["severity"] ?? "low"))] ?? 3;
                $rightSeverity = $severityOrder[strtolower((string) ($right["severity"] ?? "low"))] ?? 3;
                if ($leftSeverity !== $rightSeverity) {
                    return $leftSeverity <=> $rightSeverity;
                }

                $leftDue = $left["due_at"] ?? null;
                $rightDue = $right["due_at"] ?? null;
                if ($leftDue !== $rightDue) {
                    if ($leftDue === null) {
                        return 1;
                    }
                    if ($rightDue === null) {
                        return -1;
                    }
                    return strcmp((string) $leftDue, (string) $rightDue);
                }

                return strcmp((string) ($right["updated_at"] ?? ""), (string) ($left["updated_at"] ?? ""));
            }
        );

        $this->assertSame(
            $expected,
            $priorities,
            "Wave 24 priorities must keep deterministic severity/due/update ordering."
        );
    }

    public function test_wave24_summary_route_forbidden_and_unauthorized_envelopes_are_stable(): void
    {
        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/summary");

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_summary")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties/summary");

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_summary")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_wave24_preserves_wave20_to_wave23_manager_baselines(): void
    {
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

        $assignmentContextForbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/101/assignment-context");

        $assignmentContextForbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $detailTimeline = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101");

        $detailTimeline
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "timeline" => [
                        "*" => ["id", "type", "occurred_at", "actor", "summary", "metadata"],
                    ],
                ],
            ]);
    }

    private function isAuthMeEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
