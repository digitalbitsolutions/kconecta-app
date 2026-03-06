<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProviderApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_fetch_providers(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/providers");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "*" => ["id", "name", "role", "status"],
                ],
                "meta" => ["count", "filters" => ["role", "status"]],
            ]);
    }

    public function test_authenticated_user_can_filter_providers_by_status(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/providers?status=active");

        $response
            ->assertOk()
            ->assertJsonPath("meta.filters.status", "active");
    }
}
