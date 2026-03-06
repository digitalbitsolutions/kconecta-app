<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProviderController;
use App\Http\Controllers\Api\PropertyController;
use Illuminate\Support\Facades\Route;

Route::post("/login", [AuthController::class, "login"]);
Route::post("/refresh", [AuthController::class, "refresh"]);
Route::post("/logout", [AuthController::class, "logout"]);

Route::get("/providers", [ProviderController::class, "index"]);
Route::get("/providers/{id}", [ProviderController::class, "show"]);
Route::get("/properties", [PropertyController::class, "index"]);
Route::get("/properties/{id}", [PropertyController::class, "show"]);
