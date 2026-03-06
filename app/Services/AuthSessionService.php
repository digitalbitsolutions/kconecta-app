<?php

namespace App\Services;

use Illuminate\Support\Facades\Auth;

class AuthSessionService
{
    public function getUser()
    {
        return Auth::user();
    }

    public function invalidateUserSessions($userId)
    {
        // Revoke all tokens for the user
        Auth::user()->tokens()->delete();
    }
}
