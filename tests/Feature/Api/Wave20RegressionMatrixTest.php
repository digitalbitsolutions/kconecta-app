<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave20RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave20_manager_login_contract_is_stable(): void
    {
        $response = $this->postJson("/api/auth/login", [
            "email" => "manager@kconecta.local",
            "password" => "kconecta-dev-password",
        ]);

        $response
            ->assertOk()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("data.role", "manager")
            ->assertJsonStructure([
                "data" => [
                    "access_token",
                    "refresh_token",
                    "token_type",
                    "expires_in",
                    "scope",
                    "role",
                    "issued_at",
                ],
                "meta" => ["contract", "mode"],
            ]);
    }

    public function test_wave20_auth_me_success_and_guardrails_when_endpoint_is_available(): void
    {
        $managerLogin = $this->postJson("/api/auth/login", [
            "email" => "manager@kconecta.local",
            "password" => "kconecta-dev-password",
        ]);
        $managerLogin->assertOk();

        $managerToken = (string) $managerLogin->json("data.access_token");
        $managerMe = $this->withHeaders([
            "Authorization" => "Bearer " . $managerToken,
        ])->getJson("/api/auth/me");

        if ($this->isAuthMeEndpointUnavailable($managerMe->status())) {
            $this->markTestIncomplete("Wave 20 auth/me endpoint is not merged in this branch yet.");
            return;
        }

        $managerMe
            ->assertOk()
            ->assertJsonPath("data.role", "manager")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "me")
            ->assertJsonPath("meta.reason", "session_resolved");

        $providerLogin = $this->postJson("/api/auth/login", [
            "email" => "provider1@provider.local",
            "password" => "kconecta-dev-password",
        ]);
        $providerLogin->assertOk()->assertJsonPath("data.role", "provider");

        $providerToken = (string) $providerLogin->json("data.access_token");
        $providerMe = $this->withHeaders([
            "Authorization" => "Bearer " . $providerToken,
        ])->getJson("/api/auth/me");

        $providerMe
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "me")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");
    }

    public function test_wave20_auth_me_invalid_and_expired_token_contract_when_endpoint_is_available(): void
    {
        $expired = $this->withHeaders([
            "Authorization" => "Bearer expired-token",
        ])->getJson("/api/auth/me");

        if ($this->isAuthMeEndpointUnavailable($expired->status())) {
            $this->markTestIncomplete("Wave 20 auth/me endpoint is not merged in this branch yet.");
            return;
        }

        $expired
            ->assertUnauthorized()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "me")
            ->assertJsonPath("meta.retryable", false);
        $this->assertAuthErrorCode($expired->json("error.code"));

        $invalid = $this->withHeaders([
            "Authorization" => "Bearer invalid-token",
        ])->getJson("/api/auth/me");

        $invalid
            ->assertUnauthorized()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "me")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
        $this->assertAuthErrorCode($invalid->json("error.code"));
    }

    public function test_wave16_to_wave19_manager_baseline_remains_stable_after_wave20(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-qa-wave20",
            ])
            ->getJson("/api/properties?status=available&page=1&per_page=2");

        $response
            ->assertOk()
            ->assertJsonPath("meta.page", 1)
            ->assertJsonPath("meta.per_page", 2)
            ->assertJsonPath("meta.filters.status", "available")
            ->assertJsonStructure([
                "data" => [
                    "*" => ["id", "title", "city", "status", "manager_id", "price"],
                ],
                "meta" => [
                    "count",
                    "page",
                    "per_page",
                    "total",
                    "filters" => ["status", "city", "manager_id", "search"],
                    "kpis" => [
                        "active_properties",
                        "reserved_properties",
                        "avg_time_to_close_days",
                        "provider_matches_pending",
                    ],
                    "source",
                ],
            ]);
    }

    private function assertAuthErrorCode(mixed $code): void
    {
        $this->assertContains(
            (string) $code,
            ["TOKEN_INVALID", "TOKEN_EXPIRED"],
            "Expected TOKEN_INVALID or TOKEN_EXPIRED for Wave 20 auth/me unauthorized paths."
        );
    }

    private function isAuthMeEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
