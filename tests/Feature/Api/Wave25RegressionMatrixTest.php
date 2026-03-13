<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave25RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave25_priority_queue_contract_sla_and_ordering_are_deterministic(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "items" => [
                        "*" => [
                            "id",
                            "property_id",
                            "property_title",
                            "city",
                            "status",
                            "category",
                            "severity",
                            "sla_due_at",
                            "sla_state",
                            "updated_at",
                            "action",
                        ],
                    ],
                ],
                "meta" => [
                    "contract",
                    "generated_at",
                    "source",
                    "filters" => ["category", "severity", "limit"],
                    "count",
                ],
            ])
            ->assertJsonPath("meta.contract", "manager-priority-queue-v1");

        $items = $response->json("data.items", []);
        $this->assertIsArray($items);
        $this->assertNotEmpty($items);
        $this->assertSame(count($items), (int) $response->json("meta.count"));

        foreach ($items as $item) {
            $this->assertContains(
                strtolower((string) ($item["category"] ?? "")),
                ["provider_assignment", "maintenance_follow_up", "portfolio_review", "quality_alert"]
            );
            $this->assertContains(
                strtolower((string) ($item["severity"] ?? "")),
                ["high", "medium", "low"]
            );
            $this->assertContains(
                strtolower((string) ($item["sla_state"] ?? "")),
                ["on_track", "at_risk", "overdue", "no_deadline"]
            );
            $this->assertContains(
                strtolower((string) ($item["action"] ?? "")),
                ["open_handoff", "open_property", "review_status"]
            );

            $slaDueAt = $item["sla_due_at"] ?? null;
            if ($slaDueAt === null) {
                $this->assertSame("no_deadline", strtolower((string) ($item["sla_state"] ?? "")));
                continue;
            }

            $this->assertNotSame("", trim((string) $slaDueAt));
        }

        $severityOrder = [
            "high" => 0,
            "medium" => 1,
            "low" => 2,
        ];

        $expected = $items;
        usort(
            $expected,
            static function (array $left, array $right) use ($severityOrder): int {
                $leftSeverity = $severityOrder[strtolower((string) ($left["severity"] ?? "low"))] ?? 3;
                $rightSeverity = $severityOrder[strtolower((string) ($right["severity"] ?? "low"))] ?? 3;
                if ($leftSeverity !== $rightSeverity) {
                    return $leftSeverity <=> $rightSeverity;
                }

                $leftDue = $left["sla_due_at"] ?? null;
                $rightDue = $right["sla_due_at"] ?? null;
                if ($leftDue !== $rightDue) {
                    if ($leftDue === null) {
                        return 1;
                    }
                    if ($rightDue === null) {
                        return -1;
                    }
                    return strcmp((string) $leftDue, (string) $rightDue);
                }

                $updatedComparison = strcmp((string) ($right["updated_at"] ?? ""), (string) ($left["updated_at"] ?? ""));
                if ($updatedComparison !== 0) {
                    return $updatedComparison;
                }

                return strcmp((string) ($left["id"] ?? ""), (string) ($right["id"] ?? ""));
            }
        );

        $this->assertSame(
            $expected,
            $items,
            "Wave 25 queue must keep deterministic severity/sla/updated/id ordering."
        );
    }

    public function test_wave25_priority_queue_forbidden_and_unauthorized_envelopes_are_stable(): void
    {
        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/priorities/queue");

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties/priorities/queue");

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_wave25_preserves_wave20_to_wave24_manager_baselines(): void
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

        $filterPagination = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties?status=available&page=1&per_page=2");

        $filterPagination
            ->assertOk()
            ->assertJsonPath("meta.page", 1)
            ->assertJsonPath("meta.per_page", 2)
            ->assertJsonPath("meta.filters.status", "available");

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

        $summaryContract = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/summary");

        $summaryContract
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
                "meta" => ["contract", "generated_at", "source"],
            ]);
    }

    private function isAuthMeEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
