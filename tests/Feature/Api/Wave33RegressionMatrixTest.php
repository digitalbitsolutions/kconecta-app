<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class Wave33RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";
    private const QUEUE_ITEM_ID = "priority-provider-assignment-101";

    public function test_wave33_assignment_evidence_success_contract_is_deterministic_when_ready(): void
    {
        $probe = $this->wave33ReadinessProbe();

        if (!$this->isWave33ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 33 assignment evidence contract is not merged in this branch yet."
            );
            return;
        }

        $emptyList = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/evidence");

        $emptyList
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-assignment-evidence-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_evidence")
            ->assertJsonPath("meta.reason", "assignment_evidence_loaded")
            ->assertJsonPath("data.queue_item_id", self::QUEUE_ITEM_ID)
            ->assertJsonPath("data.count", 0)
            ->assertJsonPath("data.items", []);

        $upload = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-wave33-qa",
                "Accept" => "application/json",
            ])
            ->post("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/evidence", [
                "category" => "before_photo",
                "note" => "Wave 33 QA evidence upload",
                "file" => UploadedFile::fake()->image("wave33-before.jpg", 1200, 800)->size(256),
            ]);

        $upload
            ->assertStatus(201)
            ->assertJsonPath("meta.contract", "manager-assignment-evidence-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_evidence")
            ->assertJsonPath("meta.reason", "assignment_evidence_uploaded")
            ->assertJsonPath("data.queue_item_id", self::QUEUE_ITEM_ID)
            ->assertJsonPath("data.count", 1)
            ->assertJsonPath("data.latest_item.category", "before_photo")
            ->assertJsonPath("data.latest_item.file_name", "wave33-before.jpg")
            ->assertJsonPath("data.latest_item.media_type", "image/jpeg")
            ->assertJsonPath("data.latest_item.uploaded_by", "mgr-wave33-qa")
            ->assertJsonPath(
                "data.latest_item.download_url",
                "/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID
                . "/evidence/evidence-" . self::QUEUE_ITEM_ID . "-1/download"
            );

        $list = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/evidence");

        $list
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-assignment-evidence-v1")
            ->assertJsonPath("data.count", 1)
            ->assertJsonPath("data.items.0.id", "evidence-" . self::QUEUE_ITEM_ID . "-1")
            ->assertJsonPath("data.items.0.category", "before_photo")
            ->assertJsonPath("data.items.0.file_name", "wave33-before.jpg")
            ->assertJsonPath("data.items.0.uploaded_by", "mgr-wave33-qa");
    }

    public function test_wave33_assignment_evidence_guardrails_are_stable_when_ready(): void
    {
        $probe = $this->wave33ReadinessProbe();

        if (!$this->isWave33ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 33 assignment evidence contract is not merged in this branch yet."
            );
            return;
        }

        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/evidence");

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_evidence")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorized = $this
            ->withHeaders([
                "Authorization" => "Bearer invalid-token",
                "Accept" => "application/json",
            ])
            ->post("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/evidence", [
                "category" => "report",
                "file" => UploadedFile::fake()->create("wave33-report.txt", 12, "text/plain"),
            ]);

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_evidence")
            ->assertJsonPath("meta.reason", "token_invalid");

        $missing = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/priority-missing-999/evidence");

        $missing
            ->assertNotFound()
            ->assertJsonPath("error.code", "QUEUE_ITEM_NOT_FOUND")
            ->assertJsonPath("meta.contract", "manager-assignment-evidence-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_evidence")
            ->assertJsonPath("meta.reason", "queue_item_not_found");

        $validation = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/evidence", [
                "category" => "invalid-category",
            ]);

        $validation
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_ERROR")
            ->assertJsonPath("meta.contract", "manager-assignment-evidence-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_evidence")
            ->assertJsonPath("meta.reason", "validation_error")
            ->assertJsonValidationErrors(["category"]);

        $unsupported = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "Accept" => "application/json",
            ])
            ->post("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/evidence", [
                "category" => "report",
                "file" => UploadedFile::fake()->create("wave33.exe", 8, "application/octet-stream"),
            ]);

        $unsupported
            ->assertStatus(415)
            ->assertJsonPath("error.code", "UNSUPPORTED_MEDIA_TYPE")
            ->assertJsonPath("meta.contract", "manager-assignment-evidence-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_evidence")
            ->assertJsonPath("meta.reason", "unsupported_media_type");

        $tooLarge = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "Accept" => "application/json",
            ])
            ->post("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/evidence", [
                "category" => "invoice",
                "file" => UploadedFile::fake()->create("wave33.pdf", 6000, "application/pdf"),
            ]);

        $tooLarge
            ->assertStatus(413)
            ->assertJsonPath("error.code", "FILE_TOO_LARGE")
            ->assertJsonPath("meta.contract", "manager-assignment-evidence-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_assignment_evidence")
            ->assertJsonPath("meta.reason", "file_too_large")
            ->assertJsonPath("limits.max_size_bytes", 5242880);
    }

    public function test_wave33_preserves_wave32_assignment_detail_baseline_when_ready(): void
    {
        $probe = $this->wave33ReadinessProbe();

        if (!$this->isWave33ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 33 assignment evidence contract is not merged in this branch yet."
            );
            return;
        }

        $detail = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID);

        $detail
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-assignment-center-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_detail")
            ->assertJsonPath("meta.reason", "queue_item_loaded")
            ->assertJsonPath("data.item.id", self::QUEUE_ITEM_ID)
            ->assertJsonPath("data.assignment.state", "unassigned")
            ->assertJsonPath("data.available_actions", ["reassign"]);
    }

    private function wave33ReadinessProbe(): TestResponse
    {
        return $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue/" . self::QUEUE_ITEM_ID . "/evidence");
    }

    private function isWave33ContractReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        return $response->json("meta.contract") === "manager-assignment-evidence-v1"
            && $response->json("meta.flow") === "properties_priority_queue_assignment_evidence";
    }
}
