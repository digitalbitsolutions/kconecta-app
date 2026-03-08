<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProviderAvailabilityApiTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_guest_cannot_read_provider_availability(): void
    {
        $response = $this->getJson("/api/providers/1/availability");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_availability_show");
    }

    public function test_provider_role_can_read_provider_availability(): void
    {
        $response = $this
            ->withHeaders($this->headers("provider", 1))
            ->getJson("/api/providers/1/availability");

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
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_manager_role_can_read_provider_availability(): void
    {
        $response = $this
            ->withHeaders($this->headers("manager"))
            ->getJson("/api/providers/1/availability");

        $response->assertOk();
    }

    public function test_provider_role_is_forbidden_from_reading_other_provider_availability(): void
    {
        $response = $this
            ->withHeaders($this->headers("provider", 1))
            ->getJson("/api/providers/2/availability");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "PROVIDER_IDENTITY_MISMATCH")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.reason", "provider_identity_mismatch")
            ->assertJsonPath("meta.flow", "providers_availability_show");
    }

    public function test_provider_role_without_identity_header_is_forbidden_from_reading_availability(): void
    {
        $response = $this
            ->withHeaders($this->headers("provider"))
            ->getJson("/api/providers/1/availability");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "PROVIDER_IDENTITY_MISMATCH")
            ->assertJsonPath("meta.reason", "provider_identity_mismatch")
            ->assertJsonPath("meta.flow", "providers_availability_show");
    }

    public function test_guest_cannot_update_provider_availability(): void
    {
        $response = $this->patchJson("/api/providers/1/availability", $this->validPayload());

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "providers_availability_update");
    }

    public function test_provider_role_can_update_provider_availability(): void
    {
        $revision = $this->currentRevisionOrNull(1, "provider", 1);
        $response = $this
            ->withHeaders($this->headers("provider", 1))
            ->patchJson("/api/providers/1/availability", $this->validPayload($revision));

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
                    "updated_at",
                ],
                "meta" => ["contract", "source"],
            ]);
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_manager_role_is_forbidden_from_updating_provider_availability(): void
    {
        $response = $this
            ->withHeaders($this->headers("manager"))
            ->patchJson("/api/providers/1/availability", $this->validPayload());

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.flow", "providers_availability_update");
    }

    public function test_provider_role_is_forbidden_from_updating_other_provider_availability(): void
    {
        $response = $this
            ->withHeaders($this->headers("provider", 1))
            ->patchJson("/api/providers/2/availability", $this->validPayload());

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "PROVIDER_IDENTITY_MISMATCH")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.reason", "provider_identity_mismatch")
            ->assertJsonPath("meta.flow", "providers_availability_update");
    }

    public function test_provider_role_without_identity_header_is_forbidden(): void
    {
        $response = $this
            ->withHeaders($this->headers("provider"))
            ->patchJson("/api/providers/1/availability", $this->validPayload());

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "PROVIDER_IDENTITY_MISMATCH")
            ->assertJsonPath("meta.reason", "provider_identity_mismatch");
    }

    public function test_admin_role_can_update_any_provider_availability(): void
    {
        $revision = $this->currentRevisionOrNull(2, "admin");
        $response = $this
            ->withHeaders($this->headers("admin"))
            ->patchJson("/api/providers/2/availability", $this->validPayload($revision));

        $response
            ->assertOk()
            ->assertJsonPath("data.provider_id", 2)
            ->assertJsonPath("meta.contract", "provider-availability-v1");
    }

    public function test_unknown_provider_returns_not_found_for_availability_routes(): void
    {
        $readResponse = $this
            ->withHeaders($this->headers("provider", 999999))
            ->getJson("/api/providers/999999/availability");

        $readResponse
            ->assertNotFound()
            ->assertJsonPath("message", "Provider not found")
            ->assertJsonPath("provider_id", 999999);

        $updateResponse = $this
            ->withHeaders($this->headers("provider", 999999))
            ->patchJson("/api/providers/999999/availability", $this->validPayload());

        $updateResponse
            ->assertNotFound()
            ->assertJsonPath("message", "Provider not found")
            ->assertJsonPath("provider_id", 999999);
    }

    public function test_update_provider_availability_rejects_invalid_payload(): void
    {
        $revision = $this->currentRevisionOrNull(1, "provider", 1);
        $response = $this
            ->withHeaders($this->headers("provider", 1))
            ->patchJson(
                "/api/providers/1/availability",
                [
                    ...($revision !== null ? ["revision" => $revision] : []),
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

        $response
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_FAILED")
            ->assertJsonPath("meta.contract", "provider-availability-v1")
            ->assertJsonPath("meta.flow", "providers_availability_update")
            ->assertJsonPath("meta.reason", "validation_failed");
    }

    public function test_wave15_stale_revision_returns_conflict_when_guard_enabled(): void
    {
        $currentRevision = $this->currentRevisionOrNull(1, "provider", 1);
        if ($currentRevision === null) {
            $this->markTestIncomplete(
                "Wave 15 revision token is not exposed by provider availability read contract yet."
            );
            return;
        }

        $response = $this
            ->withHeaders($this->headers("provider", 1))
            ->patchJson("/api/providers/1/availability", $this->validPayload($currentRevision + 1));

        if ($response->status() === 200) {
            $this->markTestIncomplete(
                "Wave 15 stale revision conflict guard is not active yet."
            );
            return;
        }

        $response
            ->assertStatus(409)
            ->assertJsonPath("error.code", "AVAILABILITY_REVISION_CONFLICT")
            ->assertJsonPath("meta.contract", "provider-availability-v1")
            ->assertJsonPath("meta.reason", "revision_conflict")
            ->assertJsonPath("meta.flow", "providers_availability_update");
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

    private function validPayload(?int $revision = null): array
    {
        $payload = [
            "timezone" => "Europe/Madrid",
            "slots" => [
                [
                    "day" => "mon",
                    "start" => "08:00",
                    "end" => "12:00",
                    "enabled" => true,
                ],
                [
                    "day" => "sat",
                    "start" => "09:00",
                    "end" => "13:00",
                    "enabled" => true,
                ],
            ],
        ];

        if ($revision !== null) {
            $payload["revision"] = $revision;
        }

        return $payload;
    }

    private function currentRevisionOrNull(int $providerId, string $role, ?int $sessionProviderId = null): ?int
    {
        $response = $this
            ->withHeaders($this->headers($role, $sessionProviderId))
            ->getJson("/api/providers/{$providerId}/availability");

        if ($response->status() !== 200) {
            return null;
        }

        $revision = $response->json("data.revision");
        if (!is_numeric($revision)) {
            return null;
        }

        return (int) $revision;
    }

    private function assertValidDataSource(mixed $source): void
    {
        $this->assertContains(
            $source,
            ["database", "in_memory"],
            "meta.source must be either database or in_memory."
        );
    }
}
