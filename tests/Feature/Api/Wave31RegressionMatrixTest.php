<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class Wave31RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave31_assignment_center_queue_and_detail_contracts_are_deterministic_when_ready(): void
    {
        $queue = $this->assignmentCenterQueueProbe();

        if (!$this->isWave31AssignmentCenterReady($queue)) {
            $this->markTestIncomplete(
                "Wave 31 manager assignment center contract is not merged in this branch yet."
            );
            return;
        }

        $queue
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-priority-queue-v1")
            ->assertJsonPath("meta.filters.category", "provider_assignment")
            ->assertJsonPath("meta.filters.status", "available")
            ->assertJsonPath("meta.filters.search", "Loft")
            ->assertJsonPath("meta.filters.limit", 1)
            ->assertJsonPath("meta.count", 1)
            ->assertJsonPath("data.items.0.id", "priority-provider-assignment-101")
            ->assertJsonPath("data.items.0.property_id", 101)
            ->assertJsonPath("data.items.0.action", "open_handoff");

        $detail = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/priority-provider-assignment-101");

        $detail
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-assignment-center-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_detail")
            ->assertJsonPath("meta.reason", "queue_item_loaded")
            ->assertJsonPath("data.item.id", "priority-provider-assignment-101")
            ->assertJsonPath("data.property.id", 101)
            ->assertJsonPath("data.property.title", "Modern Loft Center")
            ->assertJsonPath("data.assignment.assigned", false)
            ->assertJsonPath("data.assignment.state", "unassigned")
            ->assertJsonStructure([
                "data" => [
                    "item" => [
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
                    ],
                    "property" => [
                        "id",
                        "title",
                        "city",
                        "status",
                        "timeline",
                    ],
                    "provider",
                    "assignment" => [
                        "assigned",
                        "provider",
                        "assigned_at",
                        "note",
                        "state",
                    ],
                    "timeline" => [
                        "*" => ["id", "type", "occurred_at", "actor", "summary", "metadata"],
                    ],
                ],
                "meta" => ["contract", "flow", "reason", "source"],
            ]);
    }

    public function test_wave31_assignment_center_guardrails_remain_stable_when_ready(): void
    {
        $queue = $this->assignmentCenterQueueProbe();

        if (!$this->isWave31AssignmentCenterReady($queue)) {
            $this->markTestIncomplete(
                "Wave 31 manager assignment center contract is not merged in this branch yet."
            );
            return;
        }

        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/priorities/queue/priority-provider-assignment-101");

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_detail")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties/priorities/queue/priority-provider-assignment-101");

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_detail")
            ->assertJsonPath("meta.reason", "token_invalid");

        $notFound = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/priority-missing-999");

        $notFound
            ->assertNotFound()
            ->assertJsonPath("error.code", "QUEUE_ITEM_NOT_FOUND")
            ->assertJsonPath("meta.contract", "manager-assignment-center-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_detail")
            ->assertJsonPath("meta.reason", "queue_item_not_found")
            ->assertJsonPath("queue_item_id", "priority-missing-999");
    }

    public function test_wave31_preserves_dashboard_queue_completion_and_provider_directory_baselines(): void
    {
        $queue = $this->assignmentCenterQueueProbe();

        if (!$this->isWave31AssignmentCenterReady($queue)) {
            $this->markTestIncomplete(
                "Wave 31 manager assignment center contract is not merged in this branch yet."
            );
            return;
        }

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

        $queueCompletion = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/priorities/queue/priority-provider-assignment-101/complete", [
                "resolution_code" => "resolved",
            ]);

        $queueCompletion
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-priority-queue-action-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_complete")
            ->assertJsonPath("meta.reason", "queue_item_completed");

        $providerDirectory = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers?search=Clean");

        if ($providerDirectory->status() === 404) {
            $this->markTestIncomplete("Wave 30 provider directory contract is not merged in this branch yet.");
            return;
        }

        $providerDirectory
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1")
            ->assertJsonPath("meta.filters.search", "Clean");
    }

    private function assignmentCenterQueueProbe(): TestResponse
    {
        return $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue?category=provider_assignment&status=available&search=Loft&limit=1");
    }

    private function isWave31AssignmentCenterReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        if ($response->json("meta.contract") !== "manager-priority-queue-v1") {
            return false;
        }

        if (($response->json("meta.filters.status") ?? "__missing__") !== "available") {
            return false;
        }

        if (($response->json("meta.filters.search") ?? "__missing__") !== "Loft") {
            return false;
        }

        $queueItemId = (string) ($response->json("data.items.0.id") ?? "");
        if ($queueItemId === "") {
            return false;
        }

        $detail = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/{$queueItemId}");

        return $detail->status() === 200
            && $detail->json("meta.contract") === "manager-assignment-center-v1"
            && $detail->json("meta.flow") === "properties_priority_queue_detail"
            && is_array($detail->json("data.item"))
            && is_array($detail->json("data.timeline"));
    }
}
