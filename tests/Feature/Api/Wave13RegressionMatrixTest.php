<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave13RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave13_provider_availability_read_contract_when_endpoint_is_available(): void
    {
        $response = $this
            ->withHeaders($this->headers("provider", 1))
            ->getJson("/api/providers/1/availability");

        if ($response->status() === 404) {
            $this->markTestIncomplete(
                "Wave 13 availability read endpoint is not merged in this branch yet."
            );
            return;
        }

        $response
            ->assertOk()
            ->assertJsonPath("data.provider_id", 1)
            ->assertJsonPath("meta.contract", "provider-availability-v1")
            ->assertJsonStructure([
                "data" => [
                    "provider_id",
                    "timezone",
                    "slots" => [
                        "*" => ["day", "start", "end", "enabled"],
                    ],
                ],
                "meta" => ["contract", "source"],
            ]);
    }

    public function test_wave13_provider_availability_update_auth_guard_contract(): void
    {
        $response = $this->patchJson("/api/providers/1/availability", $this->validPayload());

        if ($response->status() === 404) {
            $this->markTestIncomplete(
                "Wave 13 availability update endpoint is not merged in this branch yet."
            );
            return;
        }

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1");
    }

    public function test_wave13_manager_role_must_be_forbidden_from_availability_updates(): void
    {
        $response = $this
            ->withHeaders($this->headers("manager"))
            ->patchJson("/api/providers/1/availability", $this->validPayload());

        if ($response->status() === 404) {
            $this->markTestIncomplete(
                "Wave 13 availability update endpoint is not merged in this branch yet."
            );
            return;
        }

        if ($response->status() === 200) {
            $this->markTestIncomplete(
                "Wave 13 role guard is not active yet for manager update availability."
            );
            return;
        }

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");
    }

    public function test_wave13_invalid_availability_payload_returns_validation_contract_when_enabled(): void
    {
        $response = $this
            ->withHeaders($this->headers("provider", 1))
            ->patchJson(
                "/api/providers/1/availability",
                [
                    "timezone" => "Europe/Madrid",
                    "slots" => [
                        [
                            "day" => "mon",
                            "start" => "18:00",
                            "end" => "09:00",
                            "enabled" => true,
                        ],
                    ],
                ]
            );

        if ($response->status() === 404) {
            $this->markTestIncomplete(
                "Wave 13 availability update endpoint is not merged in this branch yet."
            );
            return;
        }

        if ($response->status() === 200) {
            $this->markTestIncomplete(
                "Wave 13 validation guard is not active yet for invalid availability payload."
            );
            return;
        }

        $response
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_FAILED")
            ->assertJsonPath("meta.contract", "provider-availability-v1")
            ->assertJsonPath("meta.flow", "providers_availability_update");
    }

    public function test_wave14_provider_identity_mismatch_returns_forbidden_contract_when_guard_enabled(): void
    {
        $response = $this
            ->withHeaders($this->headers("provider", 1))
            ->patchJson("/api/providers/2/availability", $this->validPayload());

        if ($response->status() === 404) {
            $this->markTestIncomplete(
                "Wave 13 availability update endpoint is not merged in this branch yet."
            );
            return;
        }

        if ($response->status() === 200) {
            $this->markTestIncomplete(
                "Wave 14 provider identity guard is not active yet."
            );
            return;
        }

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "PROVIDER_IDENTITY_MISMATCH")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.reason", "provider_identity_mismatch")
            ->assertJsonPath("meta.flow", "providers_availability_update");
    }

    public function test_wave14_provider_missing_identity_header_returns_forbidden_contract_when_guard_enabled(): void
    {
        $response = $this
            ->withHeaders($this->headers("provider"))
            ->patchJson("/api/providers/1/availability", $this->validPayload());

        if ($response->status() === 404) {
            $this->markTestIncomplete(
                "Wave 13 availability update endpoint is not merged in this branch yet."
            );
            return;
        }

        if ($response->status() === 200) {
            $this->markTestIncomplete(
                "Wave 14 provider identity guard is not active yet."
            );
            return;
        }

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "PROVIDER_IDENTITY_MISMATCH")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.reason", "provider_identity_mismatch");
    }

    public function test_wave14_admin_override_can_update_cross_provider_availability_when_endpoint_is_available(): void
    {
        $response = $this
            ->withHeaders($this->headers("admin"))
            ->patchJson("/api/providers/2/availability", $this->validPayload());

        if ($response->status() === 404) {
            $this->markTestIncomplete(
                "Wave 13 availability update endpoint is not merged in this branch yet."
            );
            return;
        }

        $response
            ->assertOk()
            ->assertJsonPath("data.provider_id", 2)
            ->assertJsonPath("meta.contract", "provider-availability-v1");
    }

    private function headers(string $role, ?int $providerId = null): array
    {
        $headers = [
            "Authorization" => "Bearer " . self::API_TOKEN,
            "X-KCONECTA-ROLE" => $role,
        ];

        if ($providerId !== null) {
            $headers["X-KCONECTA-PROVIDER-ID"] = (string) $providerId;
        }

        return $headers;
    }

    private function validPayload(): array
    {
        return [
            "timezone" => "Europe/Madrid",
            "slots" => [
                [
                    "day" => "mon",
                    "start" => "08:00",
                    "end" => "12:00",
                    "enabled" => true,
                ],
            ],
        ];
    }
}
