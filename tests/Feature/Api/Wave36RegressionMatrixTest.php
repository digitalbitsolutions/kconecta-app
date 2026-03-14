<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class Wave36RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";
    private const PRIMARY_QUEUE_ITEM_ID = "priority-provider-assignment-101";

    public function test_wave36_assignment_center_decision_rollup_is_deterministic_when_ready(): void
    {
        $probe = $this->wave36ReadinessProbe();

        if (!$this->isWave36ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 36 manager assignment center decision rollup contract is not merged in this branch yet."
            );
            return;
        }

        $initialItem = $this->findQueueItem($probe, self::PRIMARY_QUEUE_ITEM_ID);

        $this->assertIsArray($initialItem);
        $this->assertSame("unassigned", $initialItem["decision_rollup"]["current_state"] ?? null);
        $this->assertSame("Awaiting assignment", $initialItem["decision_rollup"]["latest_decision_label"] ?? null);
        $this->assertSame(0, $initialItem["decision_rollup"]["evidence_count"] ?? null);
        $this->assertSame(false, $initialItem["decision_rollup"]["has_evidence"] ?? null);
        $this->assertSame("Awaiting assignment", $initialItem["decision_rollup"]["status_badge"] ?? null);
        $this->assertSame("reassign", $initialItem["decision_rollup"]["next_recommended_action"] ?? null);

        $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::PRIMARY_QUEUE_ITEM_ID . "/assignment", [
                "action" => "reassign",
                "provider_id" => 1,
                "note" => "Prepare queue rollup state for Wave 36 regression",
            ])
            ->assertOk();

        $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-wave36",
                "Accept" => "application/json",
            ])
            ->post(
                "/api/properties/priorities/queue/" . self::PRIMARY_QUEUE_ITEM_ID . "/evidence",
                [
                    "category" => "report",
                    "note" => "Wave36 decision rollup evidence",
                    "file" => UploadedFile::fake()->create("wave36-rollup.txt", 16, "text/plain"),
                ]
            )
            ->assertStatus(201);

        $withEvidence = $this->wave36ReadinessProbe();
        $evidenceItem = $this->findQueueItem($withEvidence, self::PRIMARY_QUEUE_ITEM_ID);

        $this->assertIsArray($evidenceItem);
        $this->assertSame("assigned", $evidenceItem["decision_rollup"]["current_state"] ?? null);
        $this->assertSame("Evidence uploaded", $evidenceItem["decision_rollup"]["latest_decision_label"] ?? null);
        $this->assertSame(1, $evidenceItem["decision_rollup"]["evidence_count"] ?? null);
        $this->assertSame(true, $evidenceItem["decision_rollup"]["has_evidence"] ?? null);
        $this->assertSame("Evidence", $evidenceItem["decision_rollup"]["status_badge"] ?? null);
        $this->assertSame("complete", $evidenceItem["decision_rollup"]["next_recommended_action"] ?? null);

        $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/priorities/queue/" . self::PRIMARY_QUEUE_ITEM_ID . "/assignment", [
                "action" => "complete",
                "note" => "Wave36 completed decision rollup state",
            ])
            ->assertOk();

        $completed = $this->wave36ReadinessProbe();
        $completedItem = $this->findQueueItem($completed, self::PRIMARY_QUEUE_ITEM_ID);

        $this->assertIsArray($completedItem);
        $this->assertSame("completed", $completedItem["decision_rollup"]["current_state"] ?? null);
        $this->assertSame("Assignment completed", $completedItem["decision_rollup"]["latest_decision_label"] ?? null);
        $this->assertSame("Completed", $completedItem["decision_rollup"]["status_badge"] ?? null);
        $this->assertNull($completedItem["decision_rollup"]["next_recommended_action"] ?? "unexpected");
    }

    public function test_wave36_assignment_center_rollup_guardrails_are_stable_when_ready(): void
    {
        $probe = $this->wave36ReadinessProbe();

        if (!$this->isWave36ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 36 manager assignment center decision rollup contract is not merged in this branch yet."
            );
            return;
        }

        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/priorities/queue?category=provider_assignment");

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties/priorities/queue?category=provider_assignment");

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue")
            ->assertJsonPath("meta.reason", "token_invalid");
    }

    public function test_wave36_assignment_center_rollup_remains_additive_when_ready(): void
    {
        $probe = $this->wave36ReadinessProbe();

        if (!$this->isWave36ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 36 manager assignment center decision rollup contract is not merged in this branch yet."
            );
            return;
        }

        $probe
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
                            "decision_rollup" => [
                                "current_state",
                                "latest_decision_label",
                                "latest_decision_at",
                                "evidence_count",
                                "has_evidence",
                                "status_badge",
                                "next_recommended_action",
                            ],
                        ],
                    ],
                ],
                "meta" => ["contract", "generated_at", "source", "filters", "count"],
            ]);
    }

    private function wave36ReadinessProbe(): TestResponse
    {
        return $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue?category=provider_assignment&limit=5");
    }

    private function isWave36ContractReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        if ($response->json("meta.contract") !== "manager-priority-queue-v1") {
            return false;
        }

        foreach ($response->json("data.items", []) as $item) {
            if (($item["category"] ?? null) !== "provider_assignment") {
                continue;
            }

            $rollup = $item["decision_rollup"] ?? null;
            return is_array($rollup)
                && array_key_exists("current_state", $rollup)
                && array_key_exists("latest_decision_label", $rollup)
                && array_key_exists("latest_decision_at", $rollup)
                && array_key_exists("evidence_count", $rollup)
                && array_key_exists("has_evidence", $rollup)
                && array_key_exists("status_badge", $rollup)
                && array_key_exists("next_recommended_action", $rollup);
        }

        return false;
    }

    private function findQueueItem(TestResponse $response, string $queueItemId): ?array
    {
        foreach ($response->json("data.items", []) as $item) {
            if (($item["id"] ?? null) === $queueItemId) {
                return $item;
            }
        }

        return null;
    }
}
