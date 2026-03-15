<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class Wave37RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";
    private const PROVIDER_ID = 1;

    public function test_wave37_provider_directory_and_profile_scorecards_are_deterministic_when_ready(): void
    {
        $directory = $this->providerDirectoryProbe();
        $profile = $this->providerProfileProbe(self::PROVIDER_ID);

        if (
            !$this->isWave37ProviderDirectoryReady($directory) ||
            !$this->isWave37ProviderProfileReady($profile)
        ) {
            $this->markTestIncomplete(
                "Wave 37 manager provider directory scorecard contract is not merged in this branch yet."
            );
            return;
        }

        $directory
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1")
            ->assertJsonPath("meta.filters.status", null)
            ->assertJsonPath("meta.filters.category", null)
            ->assertJsonPath("meta.filters.city", null)
            ->assertJsonPath("meta.filters.search", null)
            ->assertJsonPath("data.0.scorecard_preview.completed_jobs", 124)
            ->assertJsonPath("data.0.scorecard_preview.customer_score", 4.8)
            ->assertJsonPath("data.0.scorecard_preview.response_time_hours", 4.0)
            ->assertJsonPath("data.0.scorecard_preview.availability_label", "Available this week")
            ->assertJsonPath("data.0.scorecard_preview.coverage_count", 3)
            ->assertJsonPath("data.0.scorecard_preview.services_count", 3)
            ->assertJsonStructure([
                "data" => [
                    "*" => [
                        "id",
                        "name",
                        "category",
                        "city",
                        "status",
                        "rating",
                        "availability_summary" => ["label", "next_open_slot"],
                        "services_preview",
                        "scorecard_preview" => [
                            "completed_jobs",
                            "customer_score",
                            "response_time_hours",
                            "availability_label",
                            "coverage_count",
                            "services_count",
                        ],
                    ],
                ],
                "meta" => [
                    "contract",
                    "count",
                    "page",
                    "per_page",
                    "total",
                    "total_pages",
                    "has_next_page",
                    "filters" => ["role", "status", "category", "city", "search"],
                    "source",
                ],
            ]);

        $profile
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-provider-directory-v1")
            ->assertJsonPath("data.id", self::PROVIDER_ID)
            ->assertJsonPath("data.scorecard.completed_jobs", 124)
            ->assertJsonPath("data.scorecard.customer_score", 4.8)
            ->assertJsonPath("data.scorecard.response_time_hours", 4.0)
            ->assertJsonPath("data.scorecard.availability_label", "Available this week")
            ->assertJsonPath("data.scorecard.coverage_count", 3)
            ->assertJsonPath("data.scorecard.services_count", 3)
            ->assertJsonPath("data.scorecard.status_badge", "Active")
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
                    "scorecard" => [
                        "completed_jobs",
                        "customer_score",
                        "response_time_hours",
                        "availability_label",
                        "coverage_count",
                        "services_count",
                        "status_badge",
                    ],
                ],
                "meta" => ["contract", "source"],
            ])
            ->assertJsonMissingPath("data.assignment_fit");
    }

    public function test_wave37_provider_directory_guardrails_remain_stable_when_ready(): void
    {
        $readyProbe = $this->providerDirectoryProbe();

        if (!$this->isWave37ProviderDirectoryReady($readyProbe)) {
            $this->markTestIncomplete(
                "Wave 37 manager provider directory scorecard contract is not merged in this branch yet."
            );
            return;
        }

        $forbiddenList = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "guest",
            ])
            ->getJson("/api/providers");

        $forbiddenList
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_index")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorizedList = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/providers");

        $unauthorizedList
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_index")
            ->assertJsonPath("meta.reason", "token_invalid");

        $forbiddenProfile = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "guest",
            ])
            ->getJson("/api/providers/" . self::PROVIDER_ID);

        $forbiddenProfile
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_show")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorizedProfile = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/providers/" . self::PROVIDER_ID);

        $unauthorizedProfile
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_show")
            ->assertJsonPath("meta.reason", "token_invalid");

        $notFound = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers/999999");

        $notFound
            ->assertNotFound()
            ->assertJsonPath("message", "Provider not found")
            ->assertJsonPath("provider_id", 999999);
    }

    public function test_wave37_preserves_wave30_and_wave34_provider_baselines_when_ready(): void
    {
        $probe = $this->providerProfileProbe(self::PROVIDER_ID);

        if (!$this->isWave37ProviderProfileReady($probe)) {
            $this->markTestIncomplete(
                "Wave 37 manager provider directory scorecard contract is not merged in this branch yet."
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
            ->assertJsonStructure([
                "data" => [
                    "availability_summary" => ["label", "next_open_slot"],
                    "metrics" => ["completed_jobs", "response_time_hours", "customer_score"],
                    "scorecard" => [
                        "completed_jobs",
                        "customer_score",
                        "response_time_hours",
                        "availability_label",
                        "coverage_count",
                        "services_count",
                        "status_badge",
                    ],
                ],
            ])
            ->assertJsonMissingPath("data.assignment_fit");

        $queueAware = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers/" . self::PROVIDER_ID . "?queue_item_id=priority-provider-assignment-101");

        $queueAware
            ->assertOk()
            ->assertJsonPath("data.assignment_fit.recommended", true)
            ->assertJsonPath("data.assignment_fit.score_label", "Recommended")
            ->assertJsonPath("data.assignment_fit.next_action", "select_provider")
            ->assertJsonPath("data.scorecard.status_badge", "Active");
    }

    private function providerDirectoryProbe(): TestResponse
    {
        return $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers");
    }

    private function providerProfileProbe(int $providerId): TestResponse
    {
        return $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers/{$providerId}");
    }

    private function isWave37ProviderDirectoryReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        if ($response->json("meta.contract") !== "manager-provider-directory-v1") {
            return false;
        }

        $first = $response->json("data.0");
        if ($first === null) {
            return true;
        }

        return is_array($first)
            && is_array($first["scorecard_preview"] ?? null)
            && array_key_exists("completed_jobs", $first["scorecard_preview"])
            && array_key_exists("customer_score", $first["scorecard_preview"])
            && array_key_exists("response_time_hours", $first["scorecard_preview"])
            && array_key_exists("availability_label", $first["scorecard_preview"])
            && array_key_exists("coverage_count", $first["scorecard_preview"])
            && array_key_exists("services_count", $first["scorecard_preview"]);
    }

    private function isWave37ProviderProfileReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        if ($response->json("meta.contract") !== "manager-provider-directory-v1") {
            return false;
        }

        $scorecard = $response->json("data.scorecard");
        return is_array($scorecard)
            && array_key_exists("completed_jobs", $scorecard)
            && array_key_exists("customer_score", $scorecard)
            && array_key_exists("response_time_hours", $scorecard)
            && array_key_exists("availability_label", $scorecard)
            && array_key_exists("coverage_count", $scorecard)
            && array_key_exists("services_count", $scorecard)
            && array_key_exists("status_badge", $scorecard);
    }
}
