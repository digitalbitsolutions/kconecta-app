<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PropertyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PropertyController extends Controller
{
    public function __construct(private readonly PropertyService $propertyService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $filters = [
            "status" => $request->query("status"),
            "city" => $request->query("city"),
            "manager_id" => $request->query("manager_id"),
        ];

        $payload = $this->propertyService->listProperties($filters);

        return response()->json($payload, 200);
    }
}
