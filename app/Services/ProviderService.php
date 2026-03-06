// Add a new method for listing service providers
public function listProviders($request)
{
    // Retrieve providers from the database with filtering capabilities
    $providers = Provider::when($request->role, function ($query) use ($request) {
            $query->where('role', $request->role);
        })
        ->when($request->status, function ($query) use ($request) {
            $query->where('status', $request->status);
        })
        ->get();

    // Return the providers
    return $providers;
}
