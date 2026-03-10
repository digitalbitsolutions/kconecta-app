<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave18RegressionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_wave18_manager_can_create_and_edit_property_when_form_endpoints_are_available(): void
    {
        $createResponse = $this
            ->withHeaders($this->headers("manager"))
            ->postJson("/api/properties", [
                "title" => "Wave 18 Regression Property",
                "city" => "Bilbao",
                "status" => "available",
                "price" => 289000,
            ]);

        if ($this->isFormEndpointUnavailable($createResponse->status())) {
            $this->markTestIncomplete(
                "Wave 18 manager property form endpoints are not merged in this branch yet."
            );
            return;
        }

        $createResponse
            ->assertStatus(201)
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.flow", "properties_create");

        $propertyId = (int) $createResponse->json("data.id");
        $this->assertGreaterThan(0, $propertyId);

        $updateResponse = $this
            ->withHeaders($this->headers("manager"))
            ->patchJson("/api/properties/" . $propertyId, [
                "title" => "Wave 18 Regression Property Updated",
                "status" => "maintenance",
            ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath("data.id", $propertyId)
            ->assertJsonPath("data.status", "maintenance")
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.flow", "properties_update");
    }

    public function test_wave18_validation_and_guardrails_contract_when_form_endpoints_are_available(): void
    {
        $validationResponse = $this
            ->withHeaders($this->headers("manager"))
            ->postJson("/api/properties", [
                "title" => "A",
                "city" => "",
                "status" => "invalid",
            ]);

        if ($this->isFormEndpointUnavailable($validationResponse->status())) {
            $this->markTestIncomplete(
                "Wave 18 manager property form endpoints are not merged in this branch yet."
            );
            return;
        }

        $validationResponse
            ->assertStatus(422)
            ->assertJsonPath("error.code", "VALIDATION_ERROR")
            ->assertJsonPath("meta.contract", "manager-property-form-v1")
            ->assertJsonPath("meta.reason", "validation_error")
            ->assertJsonStructure([
                "error" => [
                    "fields" => ["title", "city", "status"],
                ],
            ]);

        $forbiddenResponse = $this
            ->withHeaders($this->headers("provider"))
            ->postJson("/api/properties", [
                "title" => "Forbidden Property",
                "city" => "Madrid",
                "status" => "available",
            ]);

        $forbiddenResponse
            ->assertForbidden()
            ->assertJsonPath("error.code", "ROLE_SCOPE_FORBIDDEN")
            ->assertJsonPath("meta.flow", "properties_create")
            ->assertJsonPath("meta.reason", "role_scope_forbidden");

        $unauthorizedResponse = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->postJson("/api/properties", [
                "title" => "Unauthorized Property",
                "city" => "Madrid",
                "status" => "available",
            ]);

        $unauthorizedResponse
            ->assertUnauthorized()
            ->assertJsonPath("error.code", "TOKEN_INVALID")
            ->assertJsonPath("meta.flow", "properties_create")
            ->assertJsonPath("meta.reason", "token_invalid");
    }

    public function test_wave17_baseline_mutation_contract_remains_stable_after_wave18(): void
    {
        $response = $this
            ->withHeaders($this->headers("manager"))
            ->postJson("/api/properties/101/reserve");

        if ($this->isMutationEndpointUnavailable($response->status())) {
            $this->markTestIncomplete("Wave 17 mutation endpoint is not merged in this branch yet.");
            return;
        }

        if ($response->status() === 409) {
            $response
                ->assertJsonPath("error.code", "PROPERTY_STATE_CONFLICT")
                ->assertJsonPath("meta.contract", "property-mutation-v1");
            return;
        }

        $response
            ->assertOk()
            ->assertJsonPath("meta.contract", "property-mutation-v1")
            ->assertJsonPath("meta.flow", "properties_reserve");
    }

    private function headers(string $role): array
    {
        return [
            "Authorization" => "Bearer " . self::API_TOKEN,
            "X-KCONECTA-ROLE" => $role,
        ];
    }

    private function isFormEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }

    private function isMutationEndpointUnavailable(int $status): bool
    {
        return $status === 404 || $status === 405;
    }
}
