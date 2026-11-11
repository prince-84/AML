<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiUsage;
use App\Models\FormField;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function company(Request $request)
    {
        return ApiResponse::ok(['company' => $request->user()->company]);
    }

    public function updateCompany(Request $request)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'trade_license_no' => ['nullable', 'string', 'max:120'],
            'sector' => ['sometimes', 'in:jewellery,real_estate,insurance,audit,exchange,other'],
            'country' => ['sometimes', 'string', 'max:120'],
            'city' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:255'],
        ]);
        $company = $request->user()->company;
        $company->update($data);
        return ApiResponse::ok(['company' => $company->fresh()], 'Company settings saved.');
    }

    public function users(Request $request)
    {
        $users = User::where('company_id', $request->user()->company_id)
            ->orderBy('id')
            ->get(['id', 'company_id', 'name', 'email', 'role', 'phone', 'last_login_at', 'created_at']);
        return ApiResponse::ok(['users' => $users]);
    }

    public function storeUser(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'in:owner,mlro,officer,viewer'],
            'phone' => ['nullable', 'string', 'max:40'],
        ]);
        $data['company_id'] = $request->user()->company_id;
        $user = User::create($data);
        return ApiResponse::ok(['user' => $user->only(['id', 'company_id', 'name', 'email', 'role', 'phone'])], 'User created.', 201);
    }

    public function updateUser(Request $request, User $user)
    {
        if ($user->company_id !== $request->user()->company_id) {
            return ApiResponse::error('User not found.', 404);
        }
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'unique:users,email,'.$user->id],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['sometimes', 'in:owner,mlro,officer,viewer'],
            'phone' => ['nullable', 'string', 'max:40'],
        ]);
        $data = array_filter($data, fn ($v) => $v !== null);
        $user->update($data);
        return ApiResponse::ok(['user' => $user->only(['id', 'company_id', 'name', 'email', 'role', 'phone', 'last_login_at'])], 'User updated.');
    }

    public function formFields()
    {
        return ApiResponse::ok(['form_fields' => FormField::orderBy('sort')->orderBy('id')->get()]);
    }

    public function updateFormFields(Request $request)
    {
        $data = $request->validate([
            'fields' => ['required', 'array'],
            'fields.*.id' => ['required', 'integer'],
            'fields.*.label' => ['sometimes', 'string', 'max:255'],
            'fields.*.is_mandatory' => ['sometimes', 'boolean'],
            'fields.*.is_enabled' => ['sometimes', 'boolean'],
            'fields.*.sort' => ['sometimes', 'integer'],
        ]);
        foreach ($data['fields'] as $row) {
            $field = FormField::find($row['id']);
            if (!$field) continue;
            $field->update(collect($row)->except('id')->all());
        }
        return ApiResponse::ok(['form_fields' => FormField::orderBy('sort')->orderBy('id')->get()], 'Form fields updated.');
    }

    public function usage(Request $request)
    {
        $company = $request->user()->company;
        $usage = ApiUsage::orderByDesc('month')->orderBy('provider')->get();
        return ApiResponse::ok([
            'company' => [
                'plan' => $company->plan,
                'plan_expires_at' => $company->plan_expires_at,
                'screening_credits_used' => $company->screening_credits_used,
            ],
            'usage' => $usage,
        ]);
    }
}
