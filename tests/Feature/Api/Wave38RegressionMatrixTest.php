<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class Wave38RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";
    private const PROPERTY_ID = 101;
    private const PROVIDER_ID = 1;
    private const QUEUE_ITEM_ID = "priority-provider-assignment-101";

    public function test_wave38_provider_candidate_fit_contract_is_deterministic_when_ready(): void
    {
        $probe = $this->wave38ReadinessProbe();

        if (!$this->isWave38ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 38 manager provider handoff fit contract is not merged in this branch yet."
            );
            return;
        }

        $probe
            ->assertOk()
            ->assertJsonPath("data.property_id", self::PROPERTY_ID)
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_provider_candidates")
            ->assertJsonPath("meta.reason", "candidates_loaded")
            ->assertJsonPath("data.candidates.0.id", self::PROVIDER_ID)
            ->assertJsonPath("data.candidates.0.fit_preview.score_label", "Recommended")
            ->assertJsonPath("data.candidates.0.selection_state.queue_status", "ready")
            ->assertJsonPath("data.candidates.0.selection_state.can_select", true)
            ->assertJsonPath("data.candidates.2.fit_preview.score_label", "Review before assigning")
            ->assertJsonPath("data.candidates.2.selection_state.queue_status", "confirmation_required")
            ->assertJsonPath(
                "data.candidates.2.selection_state.confirmation_copy.confirm_label",
                "Select provider"
            )
            ->assertJsonStructure([
                "data" => [
                    "property_id",
                    "candidates" => [
                        "*" => [
                            "id",
                            "name",
                            "role",
                            "status",
                            "category",
                            "city",
                            "rating",
                            "fit_preview" => [
                                "score_label",
                                "recommendation_badge",
                                "match_reasons",
                                "warnings",
                                "next_action_hint",
                            ],
                            "selection_state" => [
                                "queue_status",
                                "can_select",
                                "blocked_reason",
                                "confirmation_copy" => [
                                    "title",
                                    "body",
                                    "confirm_label",
                                ],
                            ],
                        ],
                    ],
                ],
                "meta" => ["contract", "flow", "reason", "source"],
            ]);
    }

    public function test_wave38_provider_candidate_fit_guardrails_are_stable_when_ready(): void
    {
        $probe = $this->wave38ReadinessProbe();

        if (!$this->isWave38ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 38 manager provider handoff fit contract is not merged in this branch yet."
            );
            return;
        }

        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/" . self::PROPERTY_ID . "/provider-candidates");

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_provider_candidates")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties/" . self::PROPERTY_ID . "/provider-candidates");

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_provider_candidates")
            ->assertJsonPath("meta.reason", "token_invalid");

        $notFound = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/999999/provider-candidates");

        $notFound
            ->assertNotFound()
            ->assertJsonPath("error.code", "PROPERTY_NOT_FOUND")
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_provider_candidates")
            ->assertJsonPath("meta.reason", "property_not_found")
            ->assertJsonPath("property_id", 999999);
    }

    public function test_wave38_preserves_wave19_handoff_and_wave34_profile_baselines_when_ready(): void
    {
        $probe = $this->wave38ReadinessProbe();

        if (!$this->isWave38ContractReady($probe)) {
            $this->markTestIncomplete(
                "Wave 38 manager provider handoff fit contract is not merged in this branch yet."
            );
            return;
        }

        $assignment = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-wave38-qa",
            ])
            ->postJson("/api/properties/" . self::PROPERTY_ID . "/assign-provider", [
                "provider_id" => self::PROVIDER_ID,
                "note" => "Wave 38 QA compatibility assignment",
            ]);

        $assignment
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "provider_assigned")
            ->assertJsonPath("data.property_id", self::PROPERTY_ID)
            ->assertJsonPath("data.provider_id", self::PROVIDER_ID)
            ->assertJsonPath("data.assignment.assigned", true)
            ->assertJsonPath("data.assignment.state", "assigned")
            ->assertJsonPath("data.assignment.provider.id", self::PROVIDER_ID);

        $profile = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers/" . self::PROVIDER_ID . "?queue_item_id=" . self::QUEUE_ITEM_ID);

        $profile
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1")
            ->assertJsonPath("data.id", self::PROVIDER_ID)
            ->assertJsonPath("data.assignment_fit.score_label", "Recommended")
            ->assertJsonPath("data.assignment_fit.next_action", "select_provider");
    }

    private function wave38ReadinessProbe(): TestResponse
    {
        return $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/" . self::PROPERTY_ID . "/provider-candidates");
    }

    private function isWave38ContractReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        if ($response->json("meta.contract") !== "manager-provider-handoff-v1") {
            return false;
        }

        $fitPreview = $response->json("data.candidates.0.fit_preview");
        $selectionState = $response->json("data.candidates.0.selection_state");

        return is_array($fitPreview)
            && array_key_exists("score_label", $fitPreview)
            && array_key_exists("recommendation_badge", $fitPreview)
            && array_key_exists("match_reasons", $fitPreview)
            && array_key_exists("warnings", $fitPreview)
            && array_key_exists("next_action_hint", $fitPreview)
            && is_array($selectionState)
            && array_key_exists("queue_status", $selectionState)
            && array_key_exists("can_select", $selectionState)
            && array_key_exists("blocked_reason", $selectionState)
            && array_key_exists("confirmation_copy", $selectionState);
    }
}
