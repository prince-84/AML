<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

class ApiResponse
{
    public static function ok($data = null, ?string $message = null, int $status = 200): JsonResponse
    {
        $body = ['success' => true];
        if ($data !== null) $body['data'] = $data;
        if ($message !== null) $body['message'] = $message;
        return response()->json($body, $status);
    }

    public static function error(string $message, int $status = 400, $data = null): JsonResponse
    {
        $body = ['success' => false, 'message' => $message];
        if ($data !== null) $body['data'] = $data;
        return response()->json($body, $status);
    }

    public static function paginated($paginator, ?string $message = null): JsonResponse
    {
        return self::ok([
            'items' => $paginator->items(),
            'total' => $paginator->total(),
            'per_page' => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
        ], $message);
    }
}
