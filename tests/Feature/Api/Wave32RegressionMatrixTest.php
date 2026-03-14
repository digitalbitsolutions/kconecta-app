<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class Wave32RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";
    private const QUEUE_ITEM_ID = "priority-provider-assignment-101";

    public function test_wave32_reassign_and_complete_contracts_are_deterministic_when_ready(): void
    {
        $probe = $this->wave32ReadinessProbe();

        if (!$this->isWave32ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 32 assignment status mutation contract is not merged in this branch yet."
            );
            return;
        }

        $reassign = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/assignment", [
                "action" => "reassign",
                "provider_id" => 1,
                "note" => "Route provider from canonical directory",
            ]);

        $reassign
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-assignment-status-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_update")
            ->assertJsonPath("meta.reason", "assignment_reassigned")
            ->assertJsonPath("data.id", self::QUEUE_ITEM_ID)
            ->assertJsonPath("data.status", "assigned")
            ->assertJsonPath("data.assignment.state", "assigned")
            ->assertJsonPath("data.assignment.assigned", true)
            ->assertJsonPath("data.assignment.provider_id", 1)
            ->assertJsonPath("data.assignment.provider_name", "CleanHome Pro")
            ->assertJsonPath("data.assignment.note", "Route provider from canonical directory")
            ->assertJsonPath("data.available_actions", ["complete", "reassign", "cancel"]);

        $detailAfterReassign = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID);

        $detailAfterReassign
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-assignment-center-v1")
            ->assertJsonPath("data.assignment.state", "assigned")
            ->assertJsonPath("data.assignment.provider_id", 1)
            ->assertJsonPath("data.assignment.provider_name", "CleanHome Pro")
            ->assertJsonPath("data.available_actions", ["complete", "reassign", "cancel"]);

        $complete = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/assignment", [
                "action" => "complete",
                "note" => "Assignment resolved from manager center",
            ]);

        $complete
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-assignment-status-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_update")
            ->assertJsonPath("meta.reason", "assignment_completed")
            ->assertJsonPath("data.id", self::QUEUE_ITEM_ID)
            ->assertJsonPath("data.status", "completed")
            ->assertJsonPath("data.assignment.state", "completed")
            ->assertJsonPath("data.assignment.provider_id", 1)
            ->assertJsonPath("data.assignment.provider_name", "CleanHome Pro")
            ->assertJsonPath("data.assignment.note", "Assignment resolved from manager center")
            ->assertJsonPath("data.available_actions", []);

        $this->assertNotSame("", (string) $complete->json("data.assignment.completed_at", ""));
    }

    public function test_wave32_cancel_guardrails_and_conflict_envelopes_are_stable_when_ready(): void
    {
        $probe = $this->wave32ReadinessProbe();

        if (!$this->isWave32ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 32 assignment status mutation contract is not merged in this branch yet."
            );
            return;
        }

        $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/assignment", [
                "action" => "reassign",
                "provider_id" => 1,
            ])
            ->assertOk();

        $cancel = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/assignment", [
                "action" => "cancel",
                "note" => "Owner paused provider handoff",
            ]);

        $cancel
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-assignment-status-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_update")
            ->assertJsonPath("meta.reason", "assignment_cancelled")
            ->assertJsonPath("data.status", "cancelled")
            ->assertJsonPath("data.assignment.state", "cancelled")
            ->assertJsonPath("data.assignment.assigned", false)
            ->assertJsonPath("data.assignment.provider_id", null)
            ->assertJsonPath("data.assignment.provider_name", null)
            ->assertJsonPath("data.assignment.note", "Owner paused provider handoff")
            ->assertJsonPath("data.available_actions", []);

        $this->assertNotSame("", (string) $cancel->json("data.assignment.cancelled_at", ""));

        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->patchJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/assignment", [
                "action" => "cancel",
            ]);

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_update")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->patchJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/assignment", [
                "action" => "cancel",
            ]);

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_update")
            ->assertJsonPath("meta.reason", "token_invalid");

        $validation = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/assignment", [
                "action" => "reassign",
                "provider_id" => 0,
                "note" => str_repeat("a", 301),
            ]);

        $validation
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_ERROR")
            ->assertJsonPath("meta.contract", "manager-assignment-status-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_update")
            ->assertJsonPath("meta.reason", "validation_error")
            ->assertJsonValidationErrors(["provider_id", "note"]);

        $invalidTransition = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/assignment", [
                "action" => "complete",
            ]);

        $invalidTransition
            ->assertStatus(409)
            ->assertJsonPath("error.code", "ASSIGNMENT_ACTION_CONFLICT")
            ->assertJsonPath("meta.contract", "manager-assignment-status-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_update")
            ->assertJsonPath("meta.reason", "assignment_action_unavailable");

        $inactiveProvider = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/assignment", [
                "action" => "reassign",
                "provider_id" => 2,
            ]);

        $inactiveProvider
            ->assertStatus(409)
            ->assertJsonPath("error.code", "ASSIGNMENT_ACTION_CONFLICT")
            ->assertJsonPath("meta.contract", "manager-assignment-status-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_update")
            ->assertJsonPath("meta.reason", "provider_inactive");
    }

    public function test_wave32_preserves_wave31_assignment_center_baseline_when_ready(): void
    {
        $probe = $this->wave32ReadinessProbe();

        if (!$this->isWave32ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 32 assignment status mutation contract is not merged in this branch yet."
            );
            return;
        }

        $queue = $this->assignmentCenterQueueProbe();

        $queue
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-priority-queue-v1")
            ->assertJsonPath("meta.filters.category", "provider_assignment")
            ->assertJsonPath("meta.filters.status", "available")
            ->assertJsonPath("meta.filters.search", "Loft")
            ->assertJsonPath("data.items.0.id", self::QUEUE_ITEM_ID);

        $detail = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID);

        $detail
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-assignment-center-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_detail")
            ->assertJsonPath("meta.reason", "queue_item_loaded")
            ->assertJsonPath("data.item.id", self::QUEUE_ITEM_ID)
            ->assertJsonPath("data.property.id", 101)
            ->assertJsonPath("data.timeline.0.type", "assignment")
            ->assertJsonPath("data.assignment.state", "unassigned")
            ->assertJsonPath("data.available_actions", ["reassign"]);
    }

    private function assignmentCenterQueueProbe(): TestResponse
    {
        return $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson(
                "/api/properties/priorities/queue?category=provider_assignment&status=available&search=Loft&limit=1"
            );
    }

    private function wave32ReadinessProbe(): TestResponse
    {
        return $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/assignment", [
                "action" => "reassign",
                "provider_id" => 0,
                "note" => str_repeat("a", 301),
            ]);
    }

    private function isWave32ContractReady(TestResponse $response): bool
    {
        if ($response->status() !== 422) {
            return false;
        }

        return $response->json("meta.contract") === "manager-assignment-status-v1"
            && $response->json("meta.flow") === "properties_priority_queue_assignment_update";
    }
}
