<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthSessionApiTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_auth_login_smoke_returns_contract_payload(): void
    {
        $response = $this->postJson("/api/auth/login", [
            "email" => "manager@kconecta.local",
            "password" => "kconecta-dev-password",
        ]);

        $response
            ->assertOk()
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
            ])
            ->assertJsonPath("data.token_type", "Bearer")
            ->assertJsonPath("meta.contract", "auth-session-v1");
    }

    public function test_auth_login_rejects_invalid_credentials_with_contract_meta(): void
    {
        $response = $this->postJson("/api/auth/login", [
            "email" => "manager@kconecta.local",
            "password" => "wrong-password",
        ]);

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "INVALID_CREDENTIALS")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.mode", "scaffold")
            ->assertJsonPath("meta.flow", "login")
            ->assertJsonPath("meta.reason", "invalid_credentials")
            ->assertJsonPath("meta.retryable", true);
    }

    public function test_auth_refresh_smoke_requires_authorization_with_contract_meta(): void
    {
        $response = $this->postJson("/api/auth/refresh");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.mode", "scaffold")
            ->assertJsonPath("meta.flow", "refresh")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_auth_refresh_smoke_returns_payload_for_valid_token(): void
    {
        $response = $this->withHeaders([
            "Authorization" => "Bearer " . self::API_TOKEN,
        ])->postJson("/api/auth/refresh", [
            "refresh_token" => "rtk_seed_refresh",
        ]);

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => ["access_token", "refresh_token", "token_type", "expires_in", "issued_at"],
                "meta" => ["contract", "mode"],
            ])
            ->assertJsonPath("data.refresh_token", "rtk_seed_refresh");
    }

    public function test_auth_refresh_rejects_expired_token(): void
    {
        $response = $this->withHeaders([
            "Authorization" => "Bearer expired-token",
        ])->postJson("/api/auth/refresh");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.mode", "scaffold")
            ->assertJsonPath("meta.flow", "refresh")
            ->assertJsonPath("meta.retryable", false);
        $this->assertAuthErrorCode($response->json("error.code"));
    }

    public function test_auth_refresh_rejects_invalid_token(): void
    {
        $response = $this->withHeaders([
            "Authorization" => "Bearer invalid-token",
        ])->postJson("/api/auth/refresh");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.mode", "scaffold")
            ->assertJsonPath("meta.flow", "refresh")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
        $this->assertAuthErrorCode($response->json("error.code"));
    }

    public function test_auth_logout_smoke_requires_authorization_with_contract_meta(): void
    {
        $response = $this->postJson("/api/auth/logout");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.mode", "scaffold")
            ->assertJsonPath("meta.flow", "logout")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_auth_logout_smoke_returns_revoke_payload_for_valid_token(): void
    {
        $response = $this->withHeaders([
            "Authorization" => "Bearer " . self::API_TOKEN,
        ])->postJson("/api/auth/logout");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => ["revoked", "revoked_at"],
                "meta" => ["contract", "mode"],
            ])
            ->assertJsonPath("data.revoked", true);
    }

    public function test_auth_me_requires_authorization_with_contract_meta_when_endpoint_is_available(): void
    {
        $response = $this->getJson("/api/auth/me");

        if ($this->isAuthMeEndpointUnavailable($response->status())) {
            $this->markTestIncomplete("Wave 20 auth/me endpoint is not merged in this branch yet.");
            return;
        }

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.mode", "scaffold")
            ->assertJsonPath("meta.flow", "me")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_auth_me_returns_session_payload_for_valid_manager_token_when_endpoint_is_available(): void
    {
        $login = $this->postJson("/api/auth/login", [
            "email" => "manager@kconecta.local",
            "password" => "kconecta-dev-password",
        ]);
        $login->assertOk();

        $token = (string) $login->json("data.access_token");
        $response = $this->withHeaders([
            "Authorization" => "Bearer " . $token,
        ])->getJson("/api/auth/me");

        if ($this->isAuthMeEndpointUnavailable($response->status())) {
            $this->markTestIncomplete("Wave 20 auth/me endpoint is not merged in this branch yet.");
            return;
        }

        $response
            ->assertOk()
            ->assertJsonPath("data.role", "manager")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.mode", "scaffold")
            ->assertJsonPath("meta.flow", "me")
            ->assertJsonPath("meta.reason", "session_resolved")
            ->assertJsonStructure([
                "data" => [
                    "subject",
                    "email",
                    "role",
                    "scope",
                    "provider_id",
                    "issued_at",
                ],
                "meta" => ["contract", "mode", "flow", "reason"],
            ]);

        $scope = (array) $response->json("data.scope");
        $this->assertContains("properties:*", $scope);
    }

    public function test_auth_me_rejects_provider_scope_for_manager_runtime_when_endpoint_is_available(): void
    {
        $login = $this->postJson("/api/auth/login", [
            "email" => "provider1@provider.local",
            "password" => "kconecta-dev-password",
        ]);
        $login->assertOk()->assertJsonPath("data.role", "provider");

        $token = (string) $login->json("data.access_token");
        $response = $this->withHeaders([
            "Authorization" => "Bearer " . $token,
        ])->getJson("/api/auth/me");

        if ($this->isAuthMeEndpointUnavailable($response->status())) {
            $this->markTestIncomplete("Wave 20 auth/me endpoint is not merged in this branch yet.");
            return;
        }

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.mode", "scaffold")
            ->assertJsonPath("meta.flow", "me")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);
    }

    private function assertAuthErrorCode(mixed $code): void
    {
        $this->assertContains(
            (string) $code,
            ["TOKEN_INVALID", "TOKEN_EXPIRED"],
            "Expected TOKEN_INVALID or TOKEN_EXPIRED error code for unauthorized token flow."
        );
    }

    private function isAuthMeEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
