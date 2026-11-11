<?php

use App\Http\Controllers\Api\AlertController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CaseController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\RiskController;
use App\Http\Controllers\Api\ScreeningController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\StrReportController;
use App\Http\Controllers\Api\TmAlertController;
use App\Http\Controllers\Api\TmRuleController;
use App\Http\Controllers\Api\TransactionController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Customers & documents
    Route::get('/customers', [CustomerController::class, 'index']);
    Route::post('/customers', [CustomerController::class, 'store']);
    Route::get('/customers/{customer}', [CustomerController::class, 'show']);
    Route::put('/customers/{customer}', [CustomerController::class, 'update']);
    Route::delete('/customers/{customer}', [CustomerController::class, 'destroy']);
    Route::post('/customers/{customer}/screen', [CustomerController::class, 'screen']);
    Route::post('/customers/{customer}/kyc', [CustomerController::class, 'kyc']);
    Route::post('/customers/{customer}/documents', [CustomerController::class, 'storeDocument']);
    Route::put('/documents/{document}/verify', [DocumentController::class, 'verify']);

    // Screening
    Route::get('/screening/providers', [ScreeningController::class, 'providers']);
    Route::put('/screening/providers/{provider}', [ScreeningController::class, 'updateProvider']);
    Route::post('/screening/providers/opensanctions/test-connection', [ScreeningController::class, 'testConnection']);
    Route::post('/screening/test', [ScreeningController::class, 'test']);
    Route::post('/screening/name-check', [ScreeningController::class, 'nameCheck']);
    Route::post('/screening/bulk', [ScreeningController::class, 'bulk']);
    Route::get('/screenings', [ScreeningController::class, 'index']);
    Route::get('/screenings/{screening}', [ScreeningController::class, 'show']);

    // Screening alerts
    Route::get('/alerts', [AlertController::class, 'index']);
    Route::get('/alerts/{alert}', [AlertController::class, 'show']);
    Route::put('/alerts/{alert}/decision', [AlertController::class, 'decision']);

    // Transactions & transaction monitoring
    Route::get('/transactions/stats', [TransactionController::class, 'stats']);
    Route::get('/transactions', [TransactionController::class, 'index']);
    Route::post('/transactions', [TransactionController::class, 'store']);
    Route::get('/transactions/{transaction}', [TransactionController::class, 'show']);
    Route::post('/transactions/run-monitor', [TransactionController::class, 'runMonitor']);
    Route::get('/tm-alerts', [TmAlertController::class, 'index']);
    Route::put('/tm-alerts/{tmAlert}/decision', [TmAlertController::class, 'decision']);
    Route::get('/tm-rules', [TmRuleController::class, 'index']);
    Route::put('/tm-rules/{tmRule}', [TmRuleController::class, 'update']);

    // Cases & STR reports
    Route::get('/cases', [CaseController::class, 'index']);
    Route::post('/cases', [CaseController::class, 'store']);
    Route::get('/cases/{case}', [CaseController::class, 'show']);
    Route::put('/cases/{case}', [CaseController::class, 'update']);
    Route::post('/cases/{case}/str', [CaseController::class, 'createStr']);
    Route::get('/str-reports', [StrReportController::class, 'index']);
    Route::get('/str-reports/{strReport}', [StrReportController::class, 'show']);
    Route::put('/str-reports/{strReport}', [StrReportController::class, 'update']);
    Route::get('/str-reports/{strReport}/goaml', [StrReportController::class, 'goaml']);

    // EWRA
    Route::get('/risk/ewra', [RiskController::class, 'index']);
    Route::post('/risk/ewra', [RiskController::class, 'store']);
    Route::put('/risk/ewra/{riskAssessment}', [RiskController::class, 'update']);

    // Settings
    Route::get('/settings/company', [SettingsController::class, 'company']);
    Route::put('/settings/company', [SettingsController::class, 'updateCompany']);
    Route::get('/settings/users', [SettingsController::class, 'users']);
    Route::post('/settings/users', [SettingsController::class, 'storeUser']);
    Route::put('/settings/users/{user}', [SettingsController::class, 'updateUser']);
    Route::get('/settings/form-fields', [SettingsController::class, 'formFields']);
    Route::put('/settings/form-fields', [SettingsController::class, 'updateFormFields']);
    Route::get('/settings/usage', [SettingsController::class, 'usage']);

    // Audit trail
    Route::get('/audit-logs', [AuditLogController::class, 'index']);
});
