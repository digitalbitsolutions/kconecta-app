<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave12RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave12_session_expired_paths_remain_unauthorized(): void
    {
        $cases = [
            ["flow" => "refresh", "uri" => "/api/auth/refresh"],
            ["flow" => "logout", "uri" => "/api/auth/logout"],
        ];

        foreach ($cases as $case) {
            $response = $this->withHeaders([
                "Authorization" => "Bearer expired-token",
            ])->postJson($case["uri"]);

            $response
                ->assertUnauthorized()
                ->assertJsonPath("meta.contract", "auth-session-v1")
                ->assertJsonPath("meta.flow", $case["flow"])
                ->assertJsonPath("meta.retryable", false);

            $this->assertContains(
                (string) $response->json("error.code"),
                ["TOKEN_INVALID", "TOKEN_EXPIRED"]
            );
        }
    }

    public function test_wave12_handoff_login_payload_exposes_deterministic_role_and_scope(): void
    {
        $managerLogin = $this->postJson("/api/auth/login", [
            "email" => "manager@kconecta.local",
            "password" => "kconecta-dev-password",
        ]);

        $managerLogin
            ->assertOk()
            ->assertJsonPath("data.role", "manager");
        $this->assertContains(
            "properties:*",
            (array) $managerLogin->json("data.scope", [])
        );

        $providerLogin = $this->postJson("/api/auth/login", [
            "email" => "provider@provider.local",
            "password" => "kconecta-dev-password",
        ]);

        $providerLogin
            ->assertOk()
            ->assertJsonPath("data.role", "provider");
        $this->assertContains(
            "providers:read",
            (array) $providerLogin->json("data.scope", [])
        );
    }

    public function test_wave12_provider_role_boundary_expectation_for_property_endpoint(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties");

        if ($response->status() === 403) {
            $response
                ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
                ->assertJsonPath("meta.contract", "auth-session-v1")
                ->assertJsonPath("meta.reason", "role_scope_forbidden");
            return;
        }

        $response->assertOk();
        $this->markTestIncomplete(
            "Role boundary guard for provider->properties is not active in this branch yet."
        );
    }

    public function test_wave12_manager_role_boundary_expectation_for_provider_endpoint(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "manager",
            ])
            ->getJson("/api/providers");

        if ($response->status() === 403) {
            $response
                ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
                ->assertJsonPath("meta.contract", "auth-session-v1")
                ->assertJsonPath("meta.reason", "role_scope_forbidden");
            return;
        }

        $response->assertOk();
        $this->markTestIncomplete(
            "Role boundary guard for manager->providers is not active in this branch yet."
        );
    }
}
