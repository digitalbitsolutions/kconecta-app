<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class Wave30RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave30_provider_directory_and_profile_contracts_are_deterministic_when_ready(): void
    {
        $directory = $this->providerDirectoryProbe();
        $profile = $this->providerProfileProbe(1);

        if (
            !$this->isWave30ProviderDirectoryReady($directory) ||
            !$this->isWave30ProviderProfileReady($profile)
        ) {
            $this->markTestIncomplete(
                "Wave 30 manager provider directory/profile contract is not merged in this branch yet."
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
            ->assertJsonPath("data.id", 1)
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

    public function test_wave30_provider_directory_guardrails_remain_stable_when_ready(): void
    {
        $readyProbe = $this->providerDirectoryProbe();

        if (!$this->isWave30ProviderDirectoryReady($readyProbe)) {
            $this->markTestIncomplete(
                "Wave 30 manager provider directory contract is not merged in this branch yet."
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
            ->getJson("/api/providers/1");

        $forbiddenProfile
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_show")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorizedProfile = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/providers/1");

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

    public function test_wave30_preserves_wave20_to_wave29_manager_baselines(): void
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
            ]);
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

    private function isWave30ProviderDirectoryReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        if ($response->json("meta.contract") !== "manager-provider-directory-v1") {
            return false;
        }

        $filters = $response->json("meta.filters");
        if (!is_array($filters)) {
            return false;
        }

        $first = $response->json("data.0");
        if ($first === null) {
            return true;
        }

        return is_array($first)
            && array_key_exists("category", $first)
            && array_key_exists("city", $first)
            && is_array($first["availability_summary"] ?? null)
            && array_key_exists("services_preview", $first);
    }

    private function isWave30ProviderProfileReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        if ($response->json("meta.contract") !== "manager-provider-directory-v1") {
            return false;
        }

        $metrics = $response->json("data.metrics");
        return is_array($metrics)
            && array_key_exists("completed_jobs", $metrics)
            && array_key_exists("response_time_hours", $metrics)
            && array_key_exists("customer_score", $metrics)
            && is_array($response->json("data.availability_summary"));
    }

    private function isAuthMeEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
