<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();
        if (!$user || !Hash::check($data['password'], $user->password)) {
            return ApiResponse::error('Invalid email or password.', 401);
        }

        $user->last_login_at = now();
        $user->save();

        $token = $user->createToken('complyshield')->plainTextToken;

        return ApiResponse::ok([
            'token' => $token,
            'user' => $this->presentUser($user),
            'company' => $user->company,
        ], 'Signed in successfully.');
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();
        return ApiResponse::ok(null, 'Signed out.');
    }

    public function me(Request $request)
    {
        $user = $request->user();
        return ApiResponse::ok([
            'user' => $this->presentUser($user),
            'company' => $user->company,
        ]);
    }

    private function presentUser(User $user): array
    {
        return [
            'id' => $user->id,
            'company_id' => $user->company_id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'phone' => $user->phone,
            'last_login_at' => $user->last_login_at,
        ];
    }
}
