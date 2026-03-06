<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MobileApiFlowTest extends TestCase
{
    use RefreshDatabase;

    private const API_TOKEN = "kconecta-dev-token";

    public function test_mobile_flow_provider_list_to_detail_with_valid_token(): void
    {
        $listResponse = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers");

        $listResponse
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "*" => ["id", "name", "role", "status"],
                ],
            ]);

        $providers = $listResponse->json("data");
        $this->assertNotEmpty($providers, "Provider list should not be empty.");

        $providerId = (int) ($providers[0]["id"] ?? 0);
        $this->assertGreaterThan(0, $providerId, "Provider ID should be greater than zero.");

        $detailResponse = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/providers/{$providerId}");

        $detailResponse
            ->assertOk()
            ->assertJsonPath("data.id", $providerId);
    }

    public function test_mobile_flow_property_list_to_detail_with_valid_token(): void
    {
        $listResponse = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties");

        $listResponse
            ->assertOk()
            ->assertJsonStructure([
                "data" => [
                    "*" => ["id", "title", "city", "status", "manager_id", "price"],
                ],
            ]);

        $properties = $listResponse->json("data");
        $this->assertNotEmpty($properties, "Property list should not be empty.");

        $propertyId = (int) ($properties[0]["id"] ?? 0);
        $this->assertGreaterThan(0, $propertyId, "Property ID should be greater than zero.");

        $detailResponse = $this
            ->withHeaders(["Authorization" => "Bearer " . self::API_TOKEN])
            ->getJson("/api/properties/{$propertyId}");

        $detailResponse
            ->assertOk()
            ->assertJsonPath("data.id", $propertyId);
    }

    public function test_invalid_mobile_token_is_rejected_in_critical_flows(): void
    {
        $providerListResponse = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/providers");
        $providerListResponse->assertUnauthorized();

        $propertyListResponse = $this
            ->withHeaders(["Authorization" => "Bearer invalid-token"])
            ->getJson("/api/properties");
        $propertyListResponse->assertUnauthorized();
    }

    public function test_lowercase_bearer_scheme_is_accepted(): void
    {
        $response = $this
            ->withHeaders(["Authorization" => "bearer " . self::API_TOKEN])
            ->getJson("/api/providers");

        $response->assertOk();
    }
}
