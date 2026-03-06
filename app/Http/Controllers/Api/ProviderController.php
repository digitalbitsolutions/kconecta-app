// Add a new method for listing service providers
public function listProviders(Request $request)
{
    // Delegate the logic to the ProviderService
    return app('App\Services\ProviderService')->listProviders($request);
}
