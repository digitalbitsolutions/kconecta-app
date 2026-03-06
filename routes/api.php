<?php

use App\Http\Controllers\Api\ProviderController;
use Illuminate\Support\Facades\Route;

Route::middleware("auth")->group(function () {
    Route::get("/providers", [ProviderController::class, "index"]);
});
