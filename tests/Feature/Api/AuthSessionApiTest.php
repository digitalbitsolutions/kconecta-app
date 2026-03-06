<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthSessionApiTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_login_requires_email_and_password_fields(): void
    {
        $response = $this->postJson("/api/auth/login", []);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(["email", "password"]);
    }

    public function test_login_rejects_invalid_password(): void
    {
        $response = $this->postJson("/api/auth/login", [
            "email" => "manager@kconecta.local",
            "password" => "wrong-password",
        ]);

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "INVALID_CREDENTIALS");
    }

    public function test_login_returns_scaffold_contract_payload(): void
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

    public function test_refresh_requires_authorized_token(): void
    {
        $response = $this->postJson("/api/auth/refresh");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID");
    }

    public function test_refresh_returns_rotated_tokens_for_authorized_token(): void
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

    public function test_logout_requires_authorized_token(): void
    {
        $response = $this->withHeaders([
            "Authorization" => "Bearer invalid-token",
        ])->postJson("/api/auth/logout");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID");
    }

    public function test_logout_returns_revoke_payload_for_authorized_token(): void
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
}
