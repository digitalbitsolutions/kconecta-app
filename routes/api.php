<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProviderController;
use App\Http\Controllers\Api\PropertyController;
use Illuminate\Support\Facades\Route;

Route::prefix("auth")->group(function (): void {
    Route::post("/login", [AuthController::class, "login"]);
    Route::post("/refresh", [AuthController::class, "refresh"]);
    Route::post("/logout", [AuthController::class, "logout"]);
    Route::get("/me", [AuthController::class, "me"]);
});

Route::get("/providers", [ProviderController::class, "index"]);
Route::get("/providers/{id}", [ProviderController::class, "show"]);
Route::get("/providers/{id}/availability", [ProviderController::class, "availability"]);
Route::patch("/providers/{id}/availability", [ProviderController::class, "updateAvailability"]);
Route::get("/properties", [PropertyController::class, "index"]);
Route::post("/properties", [PropertyController::class, "create"]);
Route::get("/properties/{id}", [PropertyController::class, "show"]);
Route::post("/properties/{id}/reserve", [PropertyController::class, "reserve"]);
Route::post("/properties/{id}/release", [PropertyController::class, "release"]);
Route::get("/properties/{id}/provider-candidates", [PropertyController::class, "providerCandidates"]);
Route::post("/properties/{id}/assign-provider", [PropertyController::class, "assignProvider"]);
Route::patch("/properties/{id}", [PropertyController::class, "update"]);
