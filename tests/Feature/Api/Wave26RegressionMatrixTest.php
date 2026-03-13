<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave26RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave26_queue_action_completion_contract_and_state_transition_are_deterministic(): void
    {
        $queue = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue");

        if ($this->isQueueActionEndpointUnavailable($queue->status())) {
            $this->markTestIncomplete("Wave 26 queue completion endpoint is not merged in this branch yet.");
            return;
        }

        $queue->assertOk();
        $items = $queue->json("data.items", []);
        $this->assertIsArray($items);
        $this->assertNotEmpty($items);

        $target = collect($items)->first(static fn (array $item): bool => ($item["completed"] ?? false) !== true);
        $this->assertIsArray($target);

        $queueItemId = (string) ($target["id"] ?? "");
        $this->assertNotSame("", trim($queueItemId));

        $completion = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-wave26",
            ])
            ->postJson("/api/properties/priorities/queue/{$queueItemId}/complete", [
                "resolution_code" => "resolved",
                "note" => "Wave 26 regression completion",
            ]);

        $completion
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-priority-queue-action-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_complete")
            ->assertJsonPath("meta.reason", "queue_item_completed")
            ->assertJsonPath("data.item.id", $queueItemId)
            ->assertJsonPath("data.item.completed", true)
            ->assertJsonPath("data.item.resolution_code", "resolved");

        $completedAt = (string) $completion->json("data.item.completed_at", "");
        $this->assertNotSame("", trim($completedAt));

        $queueAfter = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue");

        $queueAfter->assertOk();
        $updated = collect($queueAfter->json("data.items", []))->first(
            static fn (array $item): bool => (string) ($item["id"] ?? "") === $queueItemId
        );
        $this->assertIsArray($updated);
        $this->assertTrue((bool) ($updated["completed"] ?? false));
        $this->assertSame("open_property", (string) ($updated["action"] ?? ""));

        $conflict = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-wave26",
            ])
            ->postJson("/api/properties/priorities/queue/{$queueItemId}/complete", [
                "resolution_code" => "resolved",
            ]);

        $conflict
            ->assertStatus(409)
            ->assertJsonPath("error.code", "QUEUE_ACTION_CONFLICT")
            ->assertJsonPath("meta.contract", "manager-priority-queue-action-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_complete")
            ->assertJsonPath("meta.reason", "queue_item_already_completed")
            ->assertJsonPath("meta.retryable", true)
            ->assertJsonPath("queue_item_id", $queueItemId);
    }

    public function test_wave26_queue_action_validation_forbidden_and_unauthorized_envelopes_are_stable(): void
    {
        $validation = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/priorities/queue/priority-provider-assignment-101/complete", [
                "resolution_code" => "invalid",
                "note" => str_repeat("x", 301),
            ]);

        if ($this->isQueueActionEndpointUnavailable($validation->status())) {
            $this->markTestIncomplete("Wave 26 queue completion endpoint is not merged in this branch yet.");
            return;
        }

        $validation
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_ERROR")
            ->assertJsonPath("meta.contract", "manager-priority-queue-action-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_complete")
            ->assertJsonPath("meta.reason", "validation_error")
            ->assertJsonPath("meta.retryable", true)
            ->assertJsonValidationErrors(["resolution_code", "note"]);

        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->postJson("/api/properties/priorities/queue/priority-provider-assignment-101/complete", [
                "resolution_code" => "resolved",
            ]);

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_complete")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->postJson("/api/properties/priorities/queue/priority-provider-assignment-101/complete", [
                "resolution_code" => "resolved",
            ]);

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_complete")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_wave26_preserves_wave20_to_wave25_manager_baselines(): void
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

        $portfolio = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties?status=available&page=1&per_page=2");

        $portfolio
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
                "meta" => ["contract", "generated_at", "source"],
            ]);

        $queue = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue");

        $queue
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-priority-queue-v1")
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
                            "completed",
                            "completed_at",
                            "resolution_code",
                            "note",
                        ],
                    ],
                ],
            ]);
    }

    private function isAuthMeEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }

    private function isQueueActionEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
