<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthGuardTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_guest_cannot_access_provider_endpoint(): void
    {
        $response = $this->getJson("/api/providers");
        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1");
    }

    public function test_guest_cannot_access_provider_detail_endpoint(): void
    {
        $response = $this->getJson("/api/providers/1");
        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1");
    }

    public function test_guest_cannot_access_property_endpoint(): void
    {
        $response = $this->getJson("/api/properties");
        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1");
    }

    public function test_guest_cannot_access_property_detail_endpoint(): void
    {
        $response = $this->getJson("/api/properties/101");
        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1");
    }

    public function test_invalid_bearer_token_cannot_access_property_endpoint(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties");
        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID");
    }

    public function test_empty_bearer_token_cannot_access_provider_endpoint(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer   "])
            ->getJson("/api/providers");
        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID");
    }

    public function test_expired_bearer_token_is_rejected_by_auth_refresh_endpoint(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer expired-token"])
            ->postJson("/api/auth/refresh");

        $response->assertUnauthorized();

        $code = (string) $response->json("error.code", "");
        $this->assertContains($code, ["TOKEN_INVALID", "TOKEN_EXPIRED"]);
    }

    public function test_authenticated_user_is_not_blocked_by_auth_guard(): void
    {
        $user = User::factory()->create();
        $response = $this->actingAs($user)->getJson("/api/providers");

        $this->assertNotEquals(
            401,
            $response->status(),
            "Authenticated user should not receive 401 from provider endpoint."
        );
    }

    public function test_authenticated_user_is_not_blocked_on_provider_detail_endpoint(): void
    {
        $user = User::factory()->create();
        $response = $this->actingAs($user)->getJson("/api/providers/1");

        $this->assertNotEquals(
            401,
            $response->status(),
            "Authenticated user should not receive 401 from provider detail endpoint."
        );
    }

    public function test_authenticated_user_is_not_blocked_on_property_endpoint(): void
    {
        $user = User::factory()->create();
        $response = $this->actingAs($user)->getJson("/api/properties");

        $this->assertNotEquals(
            401,
            $response->status(),
            "Authenticated user should not receive 401 from property endpoint."
        );
    }

    public function test_authenticated_user_is_not_blocked_on_property_detail_endpoint(): void
    {
        $user = User::factory()->create();
        $response = $this->actingAs($user)->getJson("/api/properties/101");

        $this->assertNotEquals(
            401,
            $response->status(),
            "Authenticated user should not receive 401 from property detail endpoint."
        );
    }

    public function test_provider_role_can_access_provider_endpoints_with_mobile_token(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/providers");

        $response->assertOk();
    }

    public function test_provider_role_is_forbidden_from_property_endpoints(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");
    }

    public function test_manager_role_can_access_property_endpoints_with_mobile_token(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "manager",
            ])
            ->getJson("/api/properties");

        $response->assertOk();
    }

    public function test_unknown_role_is_forbidden_from_provider_endpoints(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "guest",
            ])
            ->getJson("/api/providers");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN");
    }
}
