// Add a new route for listing service providers
Route::get('/providers', 'App\Http\Controllers\Api\ProviderController@listProviders');
