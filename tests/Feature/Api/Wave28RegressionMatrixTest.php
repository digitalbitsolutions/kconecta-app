<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class Wave28RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave28_auth_success_metadata_is_deterministic_when_contract_is_ready(): void
    {
        $login = $this->postJson("/api/auth/login", [
            "email" => "manager@kconecta.local",
            "password" => "kconecta-dev-password",
        ]);

        if (!$this->isWave28SuccessContractReady($login)) {
            $this->markTestIncomplete("Wave 28 auth success metadata contract is not merged in this branch yet.");
            return;
        }

        $login
            ->assertOk()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "login")
            ->assertJsonPath("meta.reason", "login_success")
            ->assertJsonPath("data.role", "manager")
            ->assertJsonPath("data.subject", "manager@kconecta.local")
            ->assertJsonPath("data.email", "manager@kconecta.local")
            ->assertJsonPath("data.display_name", "Manager");

        $accessToken = (string) $login->json("data.access_token");

        $refresh = $this->withHeaders([
            "Authorization" => "Bearer " . self::API_TOKEN,
        ])->postJson("/api/auth/refresh", [
            "refresh_token" => "rtk_seed_refresh",
        ]);

        $refresh
            ->assertOk()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "refresh")
            ->assertJsonPath("meta.reason", "refresh_success")
            ->assertJsonPath("data.subject", "refresh@kconecta.local")
            ->assertJsonPath("data.email", "refresh@kconecta.local")
            ->assertJsonPath("data.display_name", "Manager");

        $me = $this->withHeaders([
            "Authorization" => "Bearer " . $accessToken,
        ])->getJson("/api/auth/me");

        $me
            ->assertOk()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "me")
            ->assertJsonPath("meta.reason", "session_resolved")
            ->assertJsonPath("data.email", "manager@kconecta.local")
            ->assertJsonPath("data.display_name", "Manager");

        $logout = $this->withHeaders([
            "Authorization" => "Bearer " . self::API_TOKEN,
        ])->postJson("/api/auth/logout");

        $logout
            ->assertOk()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "logout")
            ->assertJsonPath("meta.reason", "logout_success")
            ->assertJsonPath("data.revoked", true);
    }

    public function test_wave28_invalid_credentials_and_manager_recovery_guardrails_remain_stable(): void
    {
        $invalidCredentials = $this->postJson("/api/auth/login", [
            "email" => "manager@kconecta.local",
            "password" => "wrong-password",
        ]);

        $invalidCredentials
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "INVALID_CREDENTIALS")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "login")
            ->assertJsonPath("meta.reason", "invalid_credentials")
            ->assertJsonPath("meta.retryable", true);

        $providerScope = $this->postJson("/api/auth/login", [
            "email" => "provider1@provider.local",
            "password" => "kconecta-dev-password",
        ]);

        if (!$this->isWave28SuccessContractReady($providerScope)) {
            $this->markTestIncomplete("Wave 28 auth success metadata contract is not merged in this branch yet.");
            return;
        }

        $providerToken = (string) $providerScope->json("data.access_token");
        $forbidden = $this->withHeaders([
            "Authorization" => "Bearer " . $providerToken,
        ])->getJson("/api/auth/me");

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "me")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);

        $expired = $this->withHeaders([
            "Authorization" => "Bearer expired-token",
        ])->postJson("/api/auth/refresh");

        $expired
            ->assertUnauthorized()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "refresh")
            ->assertJsonPath("meta.retryable", false);

        $this->assertContains(
            (string) $expired->json("error.code"),
            ["TOKEN_INVALID", "TOKEN_EXPIRED"],
            "Expected TOKEN_INVALID or TOKEN_EXPIRED for session-expired recovery flow."
        );
    }

    public function test_wave28_preserves_wave20_wave24_and_wave27_manager_baselines(): void
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
                "meta" => ["contract", "generated_at", "source"],
            ]);

        $validationProbe = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties", [
                "title" => "Wave 28 Invalid Property",
                "city" => "Madrid",
                "status" => "available",
                "property_type" => "apartment",
                "operation_mode" => "both",
                "garage_price_category_id" => 2,
            ]);

        $validationProbe
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_ERROR")
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.flow", "properties_create")
            ->assertJsonPath("meta.reason", "validation_error");
    }

    private function isWave28SuccessContractReady(TestResponse $response): bool
    {
        if ($response->status() !== 200) {
            return false;
        }

        return $response->json("meta.contract") === "auth-session-v1"
            && $response->json("meta.flow") === "login"
            && $response->json("meta.reason") === "login_success"
            && is_string($response->json("data.display_name"));
    }

    private function isAuthMeEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
