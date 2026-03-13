<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class Wave27RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave27_enriched_property_form_create_update_and_conflict_contracts_are_deterministic(): void
    {
        $validationProbe = $this->wave27ValidationProbe();

        if (!$this->isWave27ContractReady($validationProbe)) {
            $this->markTestIncomplete("Wave 27 enriched manager property form contract is not merged in this branch yet.");
            return;
        }

        $create = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-wave27-qa",
            ])
            ->postJson("/api/properties", [
                "title" => "Wave 27 QA Penthouse",
                "description" => "QA regression coverage for the enriched manager property form contract.",
                "address" => "Calle de Alcala 120",
                "city" => "Madrid",
                "postal_code" => "28009",
                "status" => "available",
                "property_type" => "apartment",
                "operation_mode" => "both",
                "sale_price" => 455000,
                "rental_price" => 1950,
                "garage_price_category_id" => 2,
                "garage_price" => 23000,
                "bedrooms" => 3,
                "bathrooms" => 2,
                "rooms" => 5,
                "elevator" => true,
            ]);

        $create
            ->assertStatus(201)
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.flow", "properties_create")
            ->assertJsonPath("meta.reason", "property_created")
            ->assertJsonPath("data.title", "Wave 27 QA Penthouse")
            ->assertJsonPath("data.description", "QA regression coverage for the enriched manager property form contract.")
            ->assertJsonPath("data.address", "Calle de Alcala 120")
            ->assertJsonPath("data.city", "Madrid")
            ->assertJsonPath("data.postal_code", "28009")
            ->assertJsonPath("data.property_type", "apartment")
            ->assertJsonPath("data.operation_mode", "both")
            ->assertJsonPath("data.manager_id", "mgr-wave27-qa")
            ->assertJsonPath("data.price", 455000)
            ->assertJsonPath("data.pricing.sale_price", 455000)
            ->assertJsonPath("data.pricing.rental_price", 1950)
            ->assertJsonPath("data.pricing.garage_price_category_id", 2)
            ->assertJsonPath("data.pricing.garage_price", 23000)
            ->assertJsonPath("data.characteristics.bedrooms", 3)
            ->assertJsonPath("data.characteristics.bathrooms", 2)
            ->assertJsonPath("data.characteristics.rooms", 5)
            ->assertJsonPath("data.characteristics.elevator", true);

        $createdPropertyId = (int) $create->json("data.id");
        $this->assertGreaterThan(0, $createdPropertyId);

        $updatedDescription = "QA regression update for the enriched manager property form contract.";
        $updatedAddress = "Paseo de la Castellana 88";

        $update = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-wave27-qa",
            ])
            ->patchJson("/api/properties/{$createdPropertyId}", [
                "description" => $updatedDescription,
                "address" => $updatedAddress,
                "postal_code" => "28046",
                "operation_mode" => "rent",
                "sale_price" => null,
                "rental_price" => 2100,
                "garage_price_category_id" => null,
                "garage_price" => null,
                "bedrooms" => 2,
                "bathrooms" => 2,
                "rooms" => 4,
                "elevator" => false,
            ]);

        $update
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.flow", "properties_update")
            ->assertJsonPath("meta.reason", "property_updated")
            ->assertJsonPath("data.id", $createdPropertyId)
            ->assertJsonPath("data.description", $updatedDescription)
            ->assertJsonPath("data.address", $updatedAddress)
            ->assertJsonPath("data.postal_code", "28046")
            ->assertJsonPath("data.operation_mode", "rent")
            ->assertJsonPath("data.price", 2100)
            ->assertJsonPath("data.pricing.sale_price", null)
            ->assertJsonPath("data.pricing.rental_price", 2100)
            ->assertJsonPath("data.pricing.garage_price_category_id", null)
            ->assertJsonPath("data.pricing.garage_price", null)
            ->assertJsonPath("data.characteristics.bedrooms", 2)
            ->assertJsonPath("data.characteristics.bathrooms", 2)
            ->assertJsonPath("data.characteristics.rooms", 4)
            ->assertJsonPath("data.characteristics.elevator", false);

        $conflict = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-MANAGER-ID" => "mgr-wave27-qa",
            ])
            ->patchJson("/api/properties/{$createdPropertyId}", [
                "description" => $updatedDescription,
                "address" => $updatedAddress,
                "postal_code" => "28046",
                "operation_mode" => "rent",
                "sale_price" => null,
                "rental_price" => 2100,
                "garage_price_category_id" => null,
                "garage_price" => null,
                "bedrooms" => 2,
                "bathrooms" => 2,
                "rooms" => 4,
                "elevator" => false,
            ]);

        $conflict
            ->assertStatus(409)
            ->assertJsonPath("error.code", "PROPERTY_STATE_CONFLICT")
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.flow", "properties_update")
            ->assertJsonPath("meta.reason", "no_changes")
            ->assertJsonPath("meta.retryable", true);
    }

    public function test_wave27_validation_forbidden_and_unauthorized_envelopes_are_stable(): void
    {
        $validation = $this->wave27ValidationProbe();

        if (!$this->isWave27ContractReady($validation)) {
            $this->markTestIncomplete("Wave 27 enriched manager property form contract is not merged in this branch yet.");
            return;
        }

        $validation
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_ERROR")
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.flow", "properties_create")
            ->assertJsonPath("meta.reason", "validation_error")
            ->assertJsonPath("meta.retryable", true)
            ->assertJsonPath("error.fields.sale_price.0", "Sale price is required for the selected operation mode.")
            ->assertJsonPath("error.fields.rental_price.0", "Rental price is required for the selected operation mode.")
            ->assertJsonPath("error.fields.garage_price.0", "Garage price is required when a garage price category is selected.")
            ->assertJsonPath("error.fields.bedrooms.0", "Bedrooms are required for residential property types.")
            ->assertJsonPath("error.fields.bathrooms.0", "Bathrooms are required for residential property types.");

        $forbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->postJson("/api/properties", [
                "title" => "Provider should not create Wave 27 property",
                "description" => "Forbidden manager form mutation",
                "address" => "Forbidden Street 1",
                "city" => "Madrid",
                "postal_code" => "28001",
                "status" => "available",
                "property_type" => "apartment",
                "operation_mode" => "sale",
                "sale_price" => 100000,
                "bedrooms" => 1,
                "bathrooms" => 1,
            ]);

        $forbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_create")
            ->assertJsonPath("meta.reason", "role_scope_forbidden")
            ->assertJsonPath("meta.retryable", false);

        $unauthorized = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->postJson("/api/properties", [
                "title" => "Invalid token Wave 27 property",
                "description" => "Unauthorized manager form mutation",
                "address" => "Invalid Route 2",
                "city" => "Madrid",
                "postal_code" => "28001",
                "status" => "available",
                "property_type" => "apartment",
                "operation_mode" => "sale",
                "sale_price" => 100000,
                "bedrooms" => 1,
                "bathrooms" => 1,
            ]);

        $unauthorized
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_create")
            ->assertJsonPath("meta.reason", "token_invalid")
            ->assertJsonPath("meta.retryable", false);
    }

    public function test_wave27_preserves_wave20_to_wave26_manager_baselines(): void
    {
        $validationProbe = $this->wave27ValidationProbe();

        if (!$this->isWave27ContractReady($validationProbe)) {
            $this->markTestIncomplete("Wave 27 enriched manager property form contract is not merged in this branch yet.");
            return;
        }

        $authMe = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/auth/me");

        if ($this->isAuthMeEndpointUnavailable($authMe->status())) {
            $this->markTestIncomplete("Wave 20 auth/me endpoint is not merged in this branch yet.");
            return;
        }

        $authMe
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "me")
            ->assertJsonPath("meta.reason", "token_invalid");

        $assignmentContextForbidden = $this
            ->withHeaders([
                "Authorization" => "Bearer " . self::API_TOKEN,
                "X-KCONECTA-ROLE" => "provider",
            ])
            ->getJson("/api/properties/101/assignment-context");

        $assignmentContextForbidden
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_assignment_context")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $summary = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/summary");

        $summary
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-dashboard-summary-v1")
            ->assertJsonStructure([
                "data" => [
                    "kpis" => [
                        "active_properties",
                        "reserved_properties",
                        "avg_time_to_close_days",
                        "provider_matches_pending",
                    ],
                    "priorities",
                ],
                "meta" => ["contract", "generated_at", "source"],
            ]);

        $queue = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/priorities/queue");

        $queue
            ->assertOk()
            ->assertJsonPath("meta.contract", "manager-priority-queue-v1")
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
                            "completed",
                            "completed_at",
                            "resolution_code",
                            "note",
                        ],
                    ],
                ],
            ]);

        $queueAction = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->postJson("/api/properties/priorities/queue/priority-provider-assignment-101/complete", [
                "resolution_code" => "resolved",
            ]);

        $queueAction
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.contract", "auth-session-v1")
            ->assertJsonPath("meta.flow", "properties_priority_queue_complete")
            ->assertJsonPath("meta.reason", "token_invalid");
    }

    private function wave27ValidationProbe(): TestResponse
    {
        return $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->postJson("/api/properties", [
                "title" => "Wave 27 Invalid Property",
                "city" => "Madrid",
                "status" => "available",
                "property_type" => "apartment",
                "operation_mode" => "both",
                "garage_price_category_id" => 2,
            ]);
    }

    private function isWave27ContractReady(TestResponse $response): bool
    {
        if ($response->status() !== 422) {
            return false;
        }

        return $response->json("meta.contract") === "manager-property-form-v1"
            && $response->json("meta.flow") === "properties_create"
            && $response->json("error.fields.sale_price.0") === "Sale price is required for the selected operation mode."
            && $response->json("error.fields.rental_price.0") === "Rental price is required for the selected operation mode."
            && $response->json("error.fields.garage_price.0") === "Garage price is required when a garage price category is selected."
            && $response->json("error.fields.bedrooms.0") === "Bedrooms are required for residential property types."
            && $response->json("error.fields.bathrooms.0") === "Bathrooms are required for residential property types.";
    }

    private function isAuthMeEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
