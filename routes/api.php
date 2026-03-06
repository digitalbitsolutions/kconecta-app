<?php

use App\Http\Controllers\Api\ProviderController;
use App\Http\Controllers\Api\PropertyController;
use Illuminate\Support\Facades\Route;

Route::middleware("auth")->group(function () {
    Route::get("/providers", [ProviderController::class, "index"]);
    Route::get("/properties", [PropertyController::class, "index"]);
    Route::get("/properties/{id}", [PropertyController::class, "show"]);
});
