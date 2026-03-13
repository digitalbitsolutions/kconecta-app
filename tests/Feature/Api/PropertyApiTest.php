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
                    "total_pages",
                    "has_next_page",
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
            ->assertJsonPath("meta.count", 1)
            ->assertJsonPath("meta.total_pages", 1)
            ->assertJsonPath("meta.has_next_page", false);
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_authenticated_user_can_fetch_property_detail(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson("/api/properties/101");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "id",
                    "title",
                    "city",
                    "status",
                    "manager_id",
                    "price",
                    "timeline" => [
                        "*" => ["id", "type", "occurred_at", "actor", "summary", "metadata"],
                    ],
                ],
            ])
            ->assertJsonPath("data.id", 101)
            ->assertJsonPath("data.timeline.0.type", "assignment")
            ->assertJsonPath("data.timeline.1.type", "status_change");
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
                    "total_pages",
                    "has_next_page",
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
            ->assertJsonPath("data.id", 101)
            ->assertJsonPath("data.timeline.0.type", "assignment");
    }

    public function test_mobile_client_can_fetch_dashboard_summary_with_priorities_contract(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/summary");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "kpis" => [
                        "active_properties",
                        "reserved_properties",
                        "avg_time_to_close_days",
                        "provider_matches_pending",
                    ],
                    "priorities" => [
                        "*" => ["id", "category", "title", "description", "severity", "due_at", "updated_at"],
                    ],
                ],
                "meta" => ["contract", "generated_at", "source"],
            ])
            ->assertJsonPath("meta.contract", "manager-dashboard-summary-v1");

        $generatedAt = $response->json("meta.generated_at");
        $this->assertIsString($generatedAt);
        $this->assertNotSame("", trim($generatedAt));
        $this->assertValidDataSource($response->json("meta.source"));
    }

    public function test_dashboard_summary_priorities_are_deterministically_ordered(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/summary");

        $response->assertOk();

        $priorities = $response->json("data.priorities", []);
        $this->assertNotEmpty($priorities);

        $severityOrder = [
            "high" => 0,
            "medium" => 1,
            "low" => 2,
        ];

        $expected = $priorities;
        usort(
            $expected,
            static function (array $left, array $right) use ($severityOrder): int {
                $leftSeverity = $severityOrder[strtolower((string) ($left["severity"] ?? "low"))] ?? 3;
                $rightSeverity = $severityOrder[strtolower((string) ($right["severity"] ?? "low"))] ?? 3;
                if ($leftSeverity !== $rightSeverity) {
                    return $leftSeverity <=> $rightSeverity;
                }

                $leftDue = $left["due_at"] ?? null;
                $rightDue = $right["due_at"] ?? null;
                if ($leftDue !== $rightDue) {
                    if ($leftDue === null) {
                        return 1;
                    }
                    if ($rightDue === null) {
                        return -1;
                    }
                    return strcmp((string) $leftDue, (string) $rightDue);
                }

                return strcmp((string) ($right["updated_at"] ?? ""), (string) ($left["updated_at"] ?? ""));
            }
        );

        $this->assertSame($expected, $priorities, "Priorities must be returned in deterministic order.");
    }

    public function test_summary_endpoint_is_forbidden_for_provider_role(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/summary");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_summary")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_invalid_bearer_token_returns_unauthorized_for_summary_endpoint(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties/summary");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_summary")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_mobile_property_detail_timeline_contains_assignment_and_status_events_in_descending_order(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101");

        $response
            ->assertOk()
            ->assertJsonPath("data.timeline.0.type", "assignment")
            ->assertJsonPath("data.timeline.1.type", "status_change");

        $timeline = $response->json("data.timeline", []);
        $this->assertIsArray($timeline);
        $this->assertCount(2, $timeline);

        $timestamps = array_map(
            static fn (array $event): string => (string) ($event["occurred_at"] ?? ""),
            $timeline
        );

        $sorted = $timestamps;
        rsort($sorted);
        $this->assertSame(
            $sorted,
            $timestamps,
            "Property detail timeline events must be sorted in descending occurred_at order."
        );
    }

    public function test_property_detail_endpoint_is_forbidden_for_provider_role(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/101");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_show")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_invalid_bearer_token_returns_unauthorized_for_property_detail_endpoint(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties/101");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_show")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
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

    public function test_wave22_properties_meta_contract_includes_pagination_fields(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties?page=2&per_page=1");

        $response
            ->assertOk()
            ->assertJsonPath("meta.page", 2)
            ->assertJsonPath("meta.per_page", 1)
            ->assertJsonPath("meta.total", 3)
            ->assertJsonPath("meta.total_pages", 3)
            ->assertJsonPath("meta.has_next_page", true)
            ->assertJsonPath("meta.count", 1);
    }

    public function test_wave22_properties_endpoint_rejects_invalid_status_filter(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties?status=invalid-status");

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(["status"]);
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

    public function test_manager_can_fetch_provider_candidates_for_property(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101/provider-candidates");

        $response
            ->assertOk()
            ->assertJsonPath("data.property_id", 101)
            ->assertJsonStructure([
                "data" => [
                    "property_id",
                    "candidates" => [
                        "*" => ["id", "name", "role", "status", "category", "city", "rating"],
                    ],
                ],
                "meta" => ["contract", "flow", "reason", "source"],
            ])
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_provider_candidates")
            ->assertJsonPath("meta.reason", "candidates_loaded");

        $this->assertNotEmpty((array) $response->json("data.candidates", []));
    }

    public function test_provider_candidates_endpoint_is_forbidden_for_provider_role(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/101/provider-candidates");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.flow", "properties_provider_candidates")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");
    }

    public function test_manager_can_assign_provider_to_property(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-009",
            ])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
                "note" => "Priority match for tenant request",
            ]);

        $response
            ->assertOk()
            ->assertJsonPath("data.property_id", 101)
            ->assertJsonPath("data.provider_id", 1)
            ->assertJsonPath("data.property.provider_id", 1)
            ->assertJsonPath("data.property.manager_id", "mgr-009")
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "provider_assigned");
    }

    public function test_assign_provider_returns_validation_error_for_missing_provider_id(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/101/assign-provider", []);

        $response
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_ERROR")
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "validation_error")
            ->assertJsonPath("error.fields.provider_id.0", "The provider id field is required.");
    }

    public function test_assign_provider_returns_not_found_for_unknown_provider(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 999999,
            ]);

        $response
            ->assertNotFound()
            ->assertJsonPath("error.code", "PROVIDER_NOT_FOUND")
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "provider_not_found")
            ->assertJsonPath("provider_id", 999999);
    }

    public function test_assign_provider_returns_conflict_for_inactive_provider(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 2,
            ]);

        $response
            ->assertStatus(409)
            ->assertJsonPath("error.code", "ASSIGNMENT_CONFLICT")
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "provider_inactive");
    }

    public function test_assign_provider_is_forbidden_for_provider_role(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
            ]);

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");
    }

    public function test_manager_can_fetch_assignment_context_for_unassigned_property(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101/assignment-context");

        $response
            ->assertOk()
            ->assertJsonPath("data.property_id", 101)
            ->assertJsonPath("data.assignment.assigned", false)
            ->assertJsonPath("data.assignment.state", "unassigned")
            ->assertJsonPath("data.assignment.provider", null)
            ->assertJsonPath("meta.contract", "manager-provider-context-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("meta.reason", "assignment_context_loaded");
    }

    public function test_manager_can_fetch_assignment_context_for_assigned_property(): void
    {
        $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-009",
            ])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
                "note" => "Wave 21 context validation",
            ])
            ->assertOk();

        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101/assignment-context");

        $response
            ->assertOk()
            ->assertJsonPath("data.property_id", 101)
            ->assertJsonPath("data.assignment.assigned", true)
            ->assertJsonPath("data.assignment.state", "assigned")
            ->assertJsonPath("data.assignment.provider.id", 1)
            ->assertJsonPath("data.assignment.provider.name", "CleanHome Pro")
            ->assertJsonPath("data.assignment.note", "Wave 21 context validation")
            ->assertJsonPath("meta.contract", "manager-provider-context-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("meta.reason", "assignment_context_loaded");
    }

    public function test_assignment_context_endpoint_is_forbidden_for_provider_role(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/101/assignment-context");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");
    }

    public function test_invalid_bearer_token_returns_unauthorized_for_assignment_context_endpoint(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties/101/assignment-context");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("meta.reason", "token_invalid");
    }

    public function test_assignment_context_returns_not_found_for_unknown_property(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/999999/assignment-context");

        $response
            ->assertNotFound()
            ->assertJsonPath("error.code", "PROPERTY_NOT_FOUND")
            ->assertJsonPath("meta.contract", "manager-provider-context-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("meta.reason", "property_not_found")
            ->assertJsonPath("meta.retryable", false)
            ->assertJsonPath("property_id", 999999);
    }

    public function test_wave19_provider_candidates_contract_when_endpoint_is_available(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101/provider-candidates");

        if ($this->isWave19HandoffEndpointUnavailable($response->status())) {
            $this->markTestIncomplete(
                "Wave 19 provider candidates endpoint is not merged in this branch yet."
            );
            return;
        }

        $response
            ->assertOk()
            ->assertJsonPath("data.property_id", 101)
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_provider_candidates")
            ->assertJsonPath("meta.reason", "candidates_loaded")
            ->assertJsonStructure([
                "data" => [
                    "property_id",
                    "candidates" => [
                        "*" => ["id", "name", "role", "status", "category", "city", "rating"],
                    ],
                ],
                "meta" => ["contract", "flow", "reason", "source"],
            ]);
    }

    public function test_wave19_assign_provider_contract_and_guardrails_when_endpoint_is_available(): void
    {
        $success = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-009",
            ])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
                "note" => "QA wave19 assignment",
            ]);

        if ($this->isWave19HandoffEndpointUnavailable($success->status())) {
            $this->markTestIncomplete(
                "Wave 19 provider assignment endpoint is not merged in this branch yet."
            );
            return;
        }

        $success
            ->assertOk()
            ->assertJsonPath("data.property_id", 101)
            ->assertJsonPath("data.provider_id", 1)
            ->assertJsonPath("data.property.provider_id", 1)
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "provider_assigned");

        $validation = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/101/assign-provider", []);

        $validation
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_ERROR")
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "validation_error")
            ->assertJsonStructure([
                "error" => [
                    "fields" => ["provider_id"],
                ],
            ]);

        $notFound = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 999999,
            ]);

        $notFound
            ->assertNotFound()
            ->assertJsonPath("error.code", "PROVIDER_NOT_FOUND")
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "provider_not_found");

        $conflict = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 2,
            ]);

        $conflict
            ->assertStatus(409)
            ->assertJsonPath("error.code", "ASSIGNMENT_CONFLICT")
            ->assertJsonPath("meta.contract", "manager-provider-handoff-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "provider_inactive");

        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
            ]);

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.flow", "properties_assign_provider")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $sessionExpired = $this
            ->withHeaders(["Authorization" => "Bearer expired-token"])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
            ]);

        $sessionExpired
            ->assertUnauthorized()
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_assign_provider");

        $this->assertContains(
            (string) $sessionExpired->json("error.code"),
            ["TOKEN_INVALID", "TOKEN_EXPIRED"],
            "Wave 19 session-expired guard should keep a deterministic auth error code."
        );
    }

    public function test_wave21_assignment_context_contract_when_endpoint_is_available(): void
    {
        $unassigned = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101/assignment-context");

        if ($this->isWave21AssignmentContextEndpointUnavailable($unassigned->status())) {
            $this->markTestIncomplete(
                "Wave 21 assignment-context endpoint is not merged in this branch yet."
            );
            return;
        }

        $unassigned
            ->assertOk()
            ->assertJsonPath("data.property_id", 101)
            ->assertJsonPath("data.assignment.assigned", false)
            ->assertJsonPath("data.assignment.state", "unassigned")
            ->assertJsonPath("meta.contract", "manager-provider-context-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("meta.reason", "assignment_context_loaded");

        $assignedMutation = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-wave21",
            ])
            ->postJson("/api/properties/101/assign-provider", [
                "provider_id" => 1,
                "note" => "Wave 21 QA assignment context check",
            ]);
        $assignedMutation->assertOk();

        $assigned = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/101/assignment-context");

        $assigned
            ->assertOk()
            ->assertJsonPath("data.assignment.assigned", true)
            ->assertJsonPath("data.assignment.state", "assigned")
            ->assertJsonPath("data.assignment.provider.id", 1)
            ->assertJsonPath("meta.contract", "manager-provider-context-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context");
    }

    public function test_mobile_client_can_fetch_manager_priority_queue_contract(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue");

        $response
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "items" => [
                        "*" => [
                            "id",
                            "property_id",
                            "property_title",
                            "city",
                            "status",
                            "category",
                            "severity",
                            "sla_due_at",
                            "sla_state",
                            "updated_at",
                            "action",
                        ],
                    ],
                ],
                "meta" => [
                    "contract",
                    "generated_at",
                    "source",
                    "filters" => ["category", "severity", "limit"],
                    "count",
                ],
            ])
            ->assertJsonPath("meta.contract", "manager-priority-queue-v1");

        $this->assertValidDataSource($response->json("meta.source"));
        $this->assertNotEmpty((array) $response->json("data.items", []));
    }

    public function test_manager_priority_queue_is_deterministically_ordered(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue");

        $response->assertOk();
        $items = $response->json("data.items", []);
        $this->assertNotEmpty($items);

        $severityOrder = [
            "high" => 0,
            "medium" => 1,
            "low" => 2,
        ];

        $expected = $items;
        usort(
            $expected,
            static function (array $left, array $right) use ($severityOrder): int {
                $leftSeverity = $severityOrder[strtolower((string) ($left["severity"] ?? "low"))] ?? 3;
                $rightSeverity = $severityOrder[strtolower((string) ($right["severity"] ?? "low"))] ?? 3;
                if ($leftSeverity !== $rightSeverity) {
                    return $leftSeverity <=> $rightSeverity;
                }

                $leftDue = $left["sla_due_at"] ?? null;
                $rightDue = $right["sla_due_at"] ?? null;
                if ($leftDue !== $rightDue) {
                    if ($leftDue === null) {
                        return 1;
                    }
                    if ($rightDue === null) {
                        return -1;
                    }
                    return strcmp((string) $leftDue, (string) $rightDue);
                }

                $updatedComparison = strcmp((string) ($right["updated_at"] ?? ""), (string) ($left["updated_at"] ?? ""));
                if ($updatedComparison !== 0) {
                    return $updatedComparison;
                }

                return strcmp((string) ($left["id"] ?? ""), (string) ($right["id"] ?? ""));
            }
        );

        $this->assertSame($expected, $items, "Priority queue must be deterministic for identical inputs.");
    }

    public function test_manager_priority_queue_exposes_valid_sla_and_action_fields(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue");

        $response->assertOk();
        $items = $response->json("data.items", []);
        $this->assertNotEmpty($items);

        foreach ($items as $item) {
            $this->assertContains(
                strtolower((string) ($item["category"] ?? "")),
                ["provider_assignment", "maintenance_follow_up", "portfolio_review", "quality_alert"]
            );
            $this->assertContains(
                strtolower((string) ($item["severity"] ?? "")),
                ["high", "medium", "low"]
            );
            $this->assertContains(
                strtolower((string) ($item["sla_state"] ?? "")),
                ["on_track", "at_risk", "overdue", "no_deadline"]
            );
            $this->assertContains(
                strtolower((string) ($item["action"] ?? "")),
                ["open_handoff", "open_property", "review_status"]
            );

            $slaDueAt = $item["sla_due_at"] ?? null;
            if ($slaDueAt === null) {
                $this->assertSame("no_deadline", strtolower((string) ($item["sla_state"] ?? "")));
                continue;
            }

            $this->assertNotSame("", trim((string) $slaDueAt));
        }
    }

    public function test_manager_priority_queue_supports_filter_and_limit_query_params(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue?category=provider_assignment&severity=high&limit=1");

        $response
            ->assertOk()
            ->assertJsonPath("meta.filters.category", "provider_assignment")
            ->assertJsonPath("meta.filters.severity", "high")
            ->assertJsonPath("meta.filters.limit", 1)
            ->assertJsonPath("meta.count", 1);

        $items = $response->json("data.items", []);
        $this->assertCount(1, $items);
        $this->assertSame("provider_assignment", $items[0]["category"] ?? null);
        $this->assertSame("high", $items[0]["severity"] ?? null);
    }

    public function test_priority_queue_endpoint_is_forbidden_for_provider_role(): void
    {
        $response = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/priorities/queue");

        $response
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_invalid_bearer_token_returns_unauthorized_for_priority_queue_endpoint(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties/priorities/queue");

        $response
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_priority_queue_rejects_invalid_filter_values(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue?severity=critical&limit=1000");

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(["severity", "limit"]);
    }

    private function assertValidDataSource(mixed $source): void
    {
        $this->assertContains(
            $source,
            ["database", "in_memory"],
            "meta.source must be either database or in_memory."
        );
    }
    private function isFormEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }

    private function isWave19HandoffEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }

    private function isWave21AssignmentContextEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
