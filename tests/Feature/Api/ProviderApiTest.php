<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class ProviderApiTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    /** @test */
    public function a_user_can_fetch_providers()
    {
        $this->withoutExceptionHandling();

        $user = factory(User::class)->create();
        $provider = factory(Provider::class)->create();

        $response = $this->actingAs($user)->get('/api/providers');

        $response->assertStatus(200);
        $response->assertJsonStructure(['data', 'links', 'meta']);
        $response->assertJsonFragment([
            'id' => $provider->id,
            'name' => $provider->name,
            // add other fields you expect in the response
        ]);
    }

    /** @test */
    public function a_user_cannot_fetch_providers_without_authentication()
    {
        $response = $this->get('/api/providers');

        $response->assertStatus(401);
        $response->assertJsonFragment(['message' => 'Unauthenticated.']);
    }
}
