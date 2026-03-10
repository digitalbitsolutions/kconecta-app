<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PropertyApiTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

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
                    "page",
                    "per_page",
                    "total",
                    "filters" => ["status", "city", "manager_id", "search"],
                    "kpis" => [
                        "active_properties",
                        "reserved_properties",
                        "avg_time_to_close_days",
                        "provider_matches_pending",
                    ],
                    "source",
                ],
            ]);
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_authenticated_user_can_filter_properties(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson(
            "/api/properties?status=available&city=Madrid&search=Modern&page=1&per_page=1"
        );

        $response
            ->assertOk()
            ->assertJsonPath("meta.filters.status", "available")
            ->assertJsonPath("meta.filters.city", "Madrid")
            ->assertJsonPath("meta.filters.search", "Modern")
            ->assertJsonPath("meta.page", 1)
            ->assertJsonPath("meta.per_page", 1)
            ->assertJsonPath("meta.count", 1);
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_authenticated_user_can_fetch_property_detail(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/properties/101");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => ["id", "title", "city", "status", "manager_id", "price"],
            ])
            ->assertJsonPath("data.id", 101);
    }

    public function test_authenticated_user_gets_not_found_for_unknown_property(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/properties/999999");

        $response
            ->assertNotFound()
            ->assertJsonPath("message", "Property not found")
            ->assertJsonPath("property_id", 999999);
    }

    public function test_mobile_client_with_bearer_token_can_fetch_properties(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "*" => ["id", "title", "city", "status", "manager_id", "price"],
                ],
                "meta" => [
                    "count",
                    "page",
                    "per_page",
                    "total",
                    "filters" => ["status", "city", "manager_id", "search"],
                    "kpis" => [
                        "active_properties",
                        "reserved_properties",
                        "avg_time_to_close_days",
                        "provider_matches_pending",
                    ],
                    "source",
                ],
            ]);
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_mobile_client_with_bearer_token_can_fetch_property_detail(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101");

        $response
            ->assertOk()
            ->assertJsonPath("data.id", 101);
    }

    public function test_properties_endpoint_returns_validation_errors_for_invalid_pagination(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties?page=0&per_page=500");

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(["page", "per_page"]);
    }

    public function test_provider_role_is_forbidden_from_manager_properties_endpoint(): void
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
            ->assertJsonPath("meta.flow", "properties_index")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_invalid_bearer_token_returns_unauthorized_error_envelope_for_properties_endpoint(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_index")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_manager_can_reserve_available_property(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/101/reserve");

        $response
            ->assertOk()
            ->assertJsonPath("data.id", 101)
            ->assertJsonPath("data.status", "reserved")
            ->assertJsonPath("meta.contract", "property-mutation-v1")
            ->assertJsonPath("meta.flow", "properties_reserve");
    }

    public function test_manager_can_release_reserved_property(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/102/release");

        $response
            ->assertOk()
            ->assertJsonPath("data.id", 102)
            ->assertJsonPath("data.status", "available")
            ->assertJsonPath("meta.contract", "property-mutation-v1")
            ->assertJsonPath("meta.flow", "properties_release");
    }

    public function test_status_update_returns_validation_error_for_invalid_value(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/101", ["status" => "invalid"]);

        $response
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_ERROR")
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.flow", "properties_update")
            ->assertJsonPath("meta.reason", "validation_error")
            ->assertJsonPath("meta.retryable", true)
            ->assertJsonPath("error.fields.status.0", "The selected status is invalid.");
    }

    public function test_manager_can_create_property_with_form_contract(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-001",
            ])
            ->postJson("/api/properties", [
                "title" => "Wave 18 Test Property",
                "city" => "Sevilla",
                "status" => "available",
                "price" => 255000,
            ]);

        $response
            ->assertStatus(201)
            ->assertJsonPath("data.title", "Wave 18 Test Property")
            ->assertJsonPath("data.city", "Sevilla")
            ->assertJsonPath("data.status", "available")
            ->assertJsonPath("data.manager_id", "mgr-001")
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.flow", "properties_create")
            ->assertJsonPath("meta.reason", "property_created");
    }

    public function test_create_property_returns_stable_validation_envelope(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties", [
                "title" => "A",
                "city" => "",
                "status" => "invalid",
            ]);

        $response
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_ERROR")
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.flow", "properties_create")
            ->assertJsonPath("meta.reason", "validation_error")
            ->assertJsonPath("meta.retryable", true)
            ->assertJsonStructure([
                "error" => [
                    "fields" => ["title", "city", "status"],
                ],
            ]);
    }

    public function test_manager_can_edit_property_form_fields(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-001",
            ])
            ->patchJson("/api/properties/101", [
                "title" => "Modern Loft Center Updated",
                "city" => "Malaga",
                "status" => "maintenance",
                "price" => 245500,
            ]);

        $response
            ->assertOk()
            ->assertJsonPath("data.id", 101)
            ->assertJsonPath("data.title", "Modern Loft Center Updated")
            ->assertJsonPath("data.city", "Malaga")
            ->assertJsonPath("data.status", "maintenance")
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.flow", "properties_update")
            ->assertJsonPath("meta.reason", "property_updated");
    }

    public function test_property_update_requires_editable_fields(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/101", []);

        $response
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_ERROR")
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.flow", "properties_update")
            ->assertJsonPath("error.fields.payload.0", "At least one editable field is required.");
    }

    public function test_property_form_create_is_forbidden_for_provider_role(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->postJson("/api/properties", [
                "title" => "Forbidden Property",
                "city" => "Madrid",
                "status" => "available",
            ]);

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.flow", "properties_create")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_manager_can_update_property_status(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/101", ["status" => "maintenance"]);

        $response
            ->assertOk()
            ->assertJsonPath("data.id", 101)
            ->assertJsonPath("data.status", "maintenance")
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.flow", "properties_update")
            ->assertJsonPath("meta.reason", "property_updated");
    }

    public function test_reserve_returns_conflict_for_already_reserved_property(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/102/reserve");

        $response
            ->assertStatus(409)
            ->assertJsonPath("error.code", "PROPERTY_STATE_CONFLICT")
            ->assertJsonPath("meta.contract", "property-mutation-v1")
            ->assertJsonPath("meta.flow", "properties_reserve")
            ->assertJsonPath("meta.reason", "already_reserved")
            ->assertJsonPath("meta.retryable", true);
    }

    public function test_status_update_returns_conflict_when_status_is_unchanged(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->patchJson("/api/properties/101", ["status" => "available"]);

        $response
            ->assertStatus(409)
            ->assertJsonPath("error.code", "PROPERTY_STATE_CONFLICT")
            ->assertJsonPath("meta.flow", "properties_update")
            ->assertJsonPath("meta.reason", "status_unchanged");
    }

    public function test_release_returns_conflict_for_non_reserved_property(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/101/release");

        $response
            ->assertStatus(409)
            ->assertJsonPath("error.code", "PROPERTY_STATE_CONFLICT")
            ->assertJsonPath("meta.flow", "properties_release")
            ->assertJsonPath("meta.reason", "not_reserved");
    }

    public function test_mutations_forbidden_for_provider_role(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->postJson("/api/properties/101/reserve");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.flow", "properties_reserve")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_mutations_require_valid_token(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->postJson("/api/properties/101/reserve");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.flow", "properties_reserve")
            ->assertJsonPath("meta.reason", "token_invalid");
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
