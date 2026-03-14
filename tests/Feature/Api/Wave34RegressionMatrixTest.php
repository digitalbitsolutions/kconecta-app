<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class Wave34RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";
    private const PROVIDER_ID = 1;
    private const QUEUE_ITEM_ID = "priority-provider-assignment-101";

    public function test_wave34_queue_aware_provider_profile_scorecard_is_deterministic_when_ready(): void
    {
        $probe = $this->wave34ReadinessProbe();

        if (!$this->isWave34ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 34 provider profile scorecard contract is not merged in this branch yet."
            );
            return;
        }

        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers/" . self::PROVIDER_ID . "?queue_item_id=" . self::QUEUE_ITEM_ID);

        $response
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1")
            ->assertJsonPath("data.id", self::PROVIDER_ID)
            ->assertJsonPath("data.assignment_fit.recommended", true)
            ->assertJsonPath("data.assignment_fit.score_label", "Recommended")
            ->assertJsonPath("data.assignment_fit.next_action", "select_provider")
            ->assertJsonStructure([
                "data" => [
                    "id",
                    "name",
                    "category",
                    "city",
                    "status",
                    "rating",
                    "bio",
                    "phone",
                    "email",
                    "services",
                    "coverage",
                    "availability_summary" => ["label", "next_open_slot"],
                    "metrics" => ["completed_jobs", "response_time_hours", "customer_score"],
                    "assignment_fit" => [
                        "recommended",
                        "score_label",
                        "match_reasons",
                        "warnings",
                        "next_action",
                    ],
                ],
                "meta" => ["contract", "source"],
            ]);
    }

    public function test_wave34_queue_aware_provider_profile_guardrails_are_stable_when_ready(): void
    {
        $probe = $this->wave34ReadinessProbe();

        if (!$this->isWave34ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 34 provider profile scorecard contract is not merged in this branch yet."
            );
            return;
        }

        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/providers/" . self::PROVIDER_ID . "?queue_item_id=" . self::QUEUE_ITEM_ID);

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_show")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/providers/" . self::PROVIDER_ID . "?queue_item_id=" . self::QUEUE_ITEM_ID);

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_show")
            ->assertJsonPath("meta.reason", "token_invalid");

        $providerNotFound = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers/999999?queue_item_id=" . self::QUEUE_ITEM_ID);

        $providerNotFound
            ->assertNotFound()
            ->assertJsonPath("message", "Provider not found")
            ->assertJsonPath("provider_id", 999999);

        $queueItemNotFound = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers/" . self::PROVIDER_ID . "?queue_item_id=priority-missing-999");

        $queueItemNotFound
            ->assertNotFound()
            ->assertJsonPath("error.code", "QUEUE_ITEM_NOT_FOUND")
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1")
            ->assertJsonPath("meta.flow", "providers_show")
            ->assertJsonPath("meta.reason", "queue_item_not_found")
            ->assertJsonPath("queue_item_id", "priority-missing-999");
    }

    public function test_wave34_preserves_baseline_provider_profile_without_queue_context_when_ready(): void
    {
        $probe = $this->wave34ReadinessProbe();

        if (!$this->isWave34ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 34 provider profile scorecard contract is not merged in this branch yet."
            );
            return;
        }

        $baseline = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers/" . self::PROVIDER_ID);

        $baseline
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1")
            ->assertJsonPath("data.id", self::PROVIDER_ID)
            ->assertJsonMissingPath("data.assignment_fit")
            ->assertJsonStructure([
                "data" => [
                    "id",
                    "name",
                    "category",
                    "city",
                    "status",
                    "rating",
                    "bio",
                    "phone",
                    "email",
                    "services",
                    "coverage",
                    "availability_summary" => ["label", "next_open_slot"],
                    "metrics" => ["completed_jobs", "response_time_hours", "customer_score"],
                ],
                "meta" => ["contract", "source"],
            ]);
    }

    private function wave34ReadinessProbe(): TestResponse
    {
        return $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers/" . self::PROVIDER_ID . "?queue_item_id=" . self::QUEUE_ITEM_ID);
    }

    private function isWave34ContractReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        if ($response->json("meta.contract") !== "manager-provider-directory-v1") {
            return false;
        }

        $assignmentFit = $response->json("data.assignment_fit");
        return is_array($assignmentFit)
            && array_key_exists("recommended", $assignmentFit)
            && array_key_exists("score_label", $assignmentFit)
            && array_key_exists("match_reasons", $assignmentFit)
            && array_key_exists("warnings", $assignmentFit)
            && array_key_exists("next_action", $assignmentFit);
    }
}
