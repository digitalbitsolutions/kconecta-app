<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ApiAccessService;
use App\Services\ProviderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProviderController extends Controller
{
    public function __construct(
        private readonly ProviderService $providerService,
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
            "role" => $request->query("role"),
            "status" => $request->query("status"),
        ];

        $payload = $this->providerService->listProviders($filters);

        return response()->json($payload, 200);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if (!$this->apiAccessService->isAuthorized($request)) {
            return response()->json(["message" => "Unauthorized"], 401);
        }

        $provider = $this->providerService->findProviderById($id);
        if ($provider === null) {
            return response()->json(
                [
                    "message" => "Provider not found",
                    "provider_id" => $id,
                ],
                404
            );
        }

        return response()->json(["data" => $provider], 200);
    }
}
