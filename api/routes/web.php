<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'status' => 'online',
        'service' => 'ComplyShield AML API',
    ])->header('X-Robots-Tag', 'noindex, nofollow, noarchive');
});
