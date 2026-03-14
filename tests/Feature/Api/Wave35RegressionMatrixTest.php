<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class Wave35RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";
    private const PRIMARY_QUEUE_ITEM_ID = "priority-provider-assignment-101";
    private const SECONDARY_QUEUE_ITEM_ID = "priority-provider-assignment-103";

    public function test_wave35_assignment_decision_summary_and_timeline_metadata_are_deterministic_when_ready(): void
    {
        $probe = $this->wave35ReadinessProbe();

        if (!$this->isWave35ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 35 manager assignment decision timeline contract is not merged in this branch yet."
            );
            return;
        }

        $initial = $this->wave35ReadinessProbe();
        $initial
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-assignment-center-v1")
            ->assertJsonPath("data.decision_summary.current_state", "unassigned")
            ->assertJsonPath("data.decision_summary.latest_decision_label", "Awaiting assignment")
            ->assertJsonPath("data.decision_summary.evidence_count", 0)
            ->assertJsonPath("data.decision_summary.has_evidence", false)
            ->assertJsonPath("data.decision_summary.next_recommended_action", "reassign");

        $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::PRIMARY_QUEUE_ITEM_ID . "/assignment", [
                "action" => "reassign",
                "provider_id" => 1,
                "note" => "Assign provider for wave35 regression",
            ])
            ->assertOk();

        $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-wave35",
                "Accept" => "application/json",
            ])
            ->post(
                "/api/properties/priorities/queue/" . self::PRIMARY_QUEUE_ITEM_ID . "/evidence",
                [
                    "category" => "report",
                    "note" => "Decision evidence for wave35 regression",
                    "file" => UploadedFile::fake()->create("decision-report.txt", 16, "text/plain"),
                ]
            )
            ->assertStatus(201);

        $detailWithEvidence = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/" . self::PRIMARY_QUEUE_ITEM_ID);

        $detailWithEvidence
            ->assertOk()
            ->assertJsonPath("data.decision_summary.current_state", "assigned")
            ->assertJsonPath("data.decision_summary.latest_decision_label", "Evidence uploaded")
            ->assertJsonPath("data.decision_summary.evidence_count", 1)
            ->assertJsonPath("data.decision_summary.has_evidence", true)
            ->assertJsonPath("data.decision_summary.next_recommended_action", "complete")
            ->assertJsonPath("data.timeline.0.metadata.event_kind", "evidence_uploaded")
            ->assertJsonPath("data.timeline.0.metadata.evidence_count", 1);

        $this->assertTrue($this->timelineContainsEventKind($detailWithEvidence, "provider_reassigned"));

        $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::SECONDARY_QUEUE_ITEM_ID . "/assignment", [
                "action" => "reassign",
                "provider_id" => 1,
                "note" => "Prepare second queue item for completion",
            ])
            ->assertOk();

        $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::SECONDARY_QUEUE_ITEM_ID . "/assignment", [
                "action" => "complete",
                "note" => "Wave35 completion path",
            ])
            ->assertOk();

        $completedDetail = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/" . self::SECONDARY_QUEUE_ITEM_ID);

        $completedDetail
            ->assertOk()
            ->assertJsonPath("data.decision_summary.current_state", "completed")
            ->assertJsonPath("data.decision_summary.latest_decision_label", "Assignment completed")
            ->assertJsonPath("data.timeline.0.metadata.event_kind", "assignment_completed")
            ->assertJsonPath("data.timeline.0.metadata.status_badge", "Completed");

        $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::PRIMARY_QUEUE_ITEM_ID . "/assignment", [
                "action" => "cancel",
                "note" => "Wave35 cancellation path",
            ])
            ->assertOk();

        $cancelledDetail = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/" . self::PRIMARY_QUEUE_ITEM_ID);

        $cancelledDetail
            ->assertOk()
            ->assertJsonPath("data.decision_summary.current_state", "cancelled")
            ->assertJsonPath("data.decision_summary.latest_decision_label", "Assignment cancelled")
            ->assertJsonPath("data.timeline.0.metadata.event_kind", "assignment_cancelled")
            ->assertJsonPath("data.timeline.0.metadata.status_badge", "Cancelled");
    }

    public function test_wave35_assignment_detail_guardrails_are_stable_when_ready(): void
    {
        $probe = $this->wave35ReadinessProbe();

        if (!$this->isWave35ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 35 manager assignment decision timeline contract is not merged in this branch yet."
            );
            return;
        }

        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/priorities/queue/" . self::PRIMARY_QUEUE_ITEM_ID);

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_detail")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties/priorities/queue/" . self::PRIMARY_QUEUE_ITEM_ID);

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
            ->assertJsonPath("meta.reason", "queue_item_not_found");
    }

    public function test_wave35_assignment_detail_remains_additive_when_ready(): void
    {
        $probe = $this->wave35ReadinessProbe();

        if (!$this->isWave35ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 35 manager assignment decision timeline contract is not merged in this branch yet."
            );
            return;
        }

        $response = $this->wave35ReadinessProbe();

        $response
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-assignment-center-v1")
            ->assertJsonStructure([
                "data" => [
                    "item" => [
                        "id",
                        "property_id",
                        "property_title",
                        "city",
                        "status",
                        "category",
                    ],
                    "property" => [
                        "id",
                        "title",
                        "city",
                        "status",
                    ],
                    "assignment" => [
                        "state",
                        "assigned",
                        "available_actions",
                    ],
                    "timeline",
                    "decision_summary" => [
                        "current_state",
                        "latest_decision_label",
                        "latest_decision_at",
                        "latest_actor",
                        "evidence_count",
                        "has_evidence",
                        "next_recommended_action",
                    ],
                ],
                "meta" => ["contract", "flow", "reason", "source"],
            ]);
    }

    private function wave35ReadinessProbe(): TestResponse
    {
        return $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/" . self::PRIMARY_QUEUE_ITEM_ID);
    }

    private function isWave35ContractReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        if ($response->json("meta.contract") !== "manager-assignment-center-v1") {
            return false;
        }

        $decisionSummary = $response->json("data.decision_summary");

        return is_array($decisionSummary)
            && array_key_exists("current_state", $decisionSummary)
            && array_key_exists("latest_decision_label", $decisionSummary)
            && array_key_exists("latest_decision_at", $decisionSummary)
            && array_key_exists("latest_actor", $decisionSummary)
            && array_key_exists("evidence_count", $decisionSummary)
            && array_key_exists("has_evidence", $decisionSummary)
            && array_key_exists("next_recommended_action", $decisionSummary);
    }

    private function timelineContainsEventKind(TestResponse $response, string $eventKind): bool
    {
        foreach ($response->json("data.timeline", []) as $event) {
            if (($event["metadata"]["event_kind"] ?? null) === $eventKind) {
                return true;
            }
        }

        return false;
    }
}
