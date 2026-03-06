<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class AuthSessionApiTest extends TestCase
{
    public function test_login_endpoint_returns_token_on_success()
    {
        $response = $this->postJson('/api/login', [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure(['token']);
    }

    public function test_login_endpoint_returns_error_on_failure()
    {
        $response = $this->postJson('/api/login', [
            'email' => 'test@example.com',<｜begin▁of▁sentence｜>
            'password' => 'wrong_password',
        ]);

        $response->assertStatus(401);
        $response->assertJsonStructure(['error']);
    }

    public function test_refresh_endpoint_returns_new_token()
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth_token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->postJson('/api/refresh');

        $response->assertStatus(200);
        $response->assertJsonStructure(['token']);
    }

    public function test_logout_endpoint_invalidates_token()
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth_token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->postJson('/api/logout');

        $response->assertStatus(200);
        $response->assertJson(['message' => 'Tokens Revoked']);
    }
}
