<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ApiAccessService;
use App\Services\PropertyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PropertyController extends Controller
{
    public function __construct(
        private readonly PropertyService $propertyService,
        private readonly ApiAccessService $apiAccessService
    )
    {
    }

    public function index(Request $request): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(["message" => "Unauthorized"], 401);
        }

        $filters = [
            "status" => $request->query("status"),
            "city" => $request->query("city"),
            "manager_id" => $request->query("manager_id"),
        ];

        $payload = $this->propertyService->listProperties($filters);

        return response()->json($payload, 200);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(["message" => "Unauthorized"], 401);
        }

        $property = $this->propertyService->findPropertyById($id);
        if ($property === null) {
            return response()->json(
                [
                    "message" => "Property not found",
                    "property_id" => $id,
                ],
                404
            );
        }

        return response()->json(["data" => $property], 200);
    }
}
