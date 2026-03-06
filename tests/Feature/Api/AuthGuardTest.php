<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_provider_endpoint(): void
    {
        $response = $this->getJson("/api/providers");
        $response->assertUnauthorized();
    }

    public function test_guest_cannot_access_property_endpoint(): void
    {
        $response = $this->getJson("/api/properties");
        $response->assertUnauthorized();
    }

    public function test_guest_cannot_access_property_detail_endpoint(): void
    {
        $response = $this->getJson("/api/properties/101");
        $response->assertUnauthorized();
    }

    public function test_invalid_bearer_token_cannot_access_property_endpoint(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties");
        $response->assertUnauthorized();
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
}
