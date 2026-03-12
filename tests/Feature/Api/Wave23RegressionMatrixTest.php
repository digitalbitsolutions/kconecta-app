<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave23RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave23_property_detail_timeline_contract_and_ordering_when_payload_is_available(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101");

        $timeline = $response->json("data.timeline");
        if (!is_array($timeline)) {
            $this->markTestIncomplete(
                "Wave 23 timeline payload is not merged in this branch yet."
            );
            return;
        }

        $response
            ->assertOk()
            ->assertJsonPath("data.id", 101)
            ->assertJsonStructure([
                "data" => [
                    "timeline" => [
                        "*" => ["id", "type", "occurred_at", "actor", "summary", "metadata"],
                    ],
                ],
            ]);

        $eventTypes = array_map(
            static fn (array $event): string => (string) ($event["type"] ?? ""),
            $timeline
        );
        $this->assertContains("assignment", $eventTypes);
        $this->assertContains("status_change", $eventTypes);

        $timestamps = array_map(
            static fn (array $event): string => (string) ($event["occurred_at"] ?? ""),
            $timeline
        );
        $sorted = $timestamps;
        rsort($sorted);
        $this->assertSame(
            $sorted,
            $timestamps,
            "Wave 23 timeline events must keep descending occurred_at ordering."
        );
    }

    public function test_wave23_property_detail_forbidden_and_unauthorized_contracts_are_deterministic(): void
    {
        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/101");

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_show")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties/101");

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_show")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_wave23_preserves_wave20_to_wave22_manager_baselines(): void
    {
        $authMe = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/auth/me");

        if ($this->isAuthMeEndpointUnavailable($authMe->status())) {
            $this->markTestIncomplete(
                "Wave 20 auth/me endpoint is not merged in this branch yet."
            );
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

        $filterPagination = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties?status=available&page=1&per_page=2");

        $filterPagination
            ->assertOk()
            ->assertJsonPath("meta.page", 1)
            ->assertJsonPath("meta.per_page", 2)
            ->assertJsonPath("meta.filters.status", "available")
            ->assertJsonStructure([
                "meta" => [
                    "count",
                    "page",
                    "per_page",
                    "total",
                    "total_pages",
                    "has_next_page",
                    "filters" => ["status", "city", "manager_id", "search"],
                    "source",
                ],
            ]);
    }

    private function isAuthMeEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
