<?php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_filter(array_merge(
        ['http://localhost:3000', 'http://127.0.0.1:3000'],
        explode(',', env('CORS_ALLOWED_ORIGINS', ''))
    )),
    'allowed_origins_patterns' => ['*.vercel.app'],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
