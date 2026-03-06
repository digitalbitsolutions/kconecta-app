<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PropertyApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_fetch_properties(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/properties");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "*" => ["id", "title", "city", "status", "manager_id", "price"],
                ],
                "meta" => [
                    "count",
                    "filters" => ["status", "city", "manager_id"],
                ],
            ]);
    }

    public function test_authenticated_user_can_filter_properties(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/properties?status=available&city=Madrid");

        $response
            ->assertOk()
            ->assertJsonPath("meta.filters.status", "available")
            ->assertJsonPath("meta.filters.city", "Madrid");
    }
}
