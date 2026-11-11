<?php

namespace App\Services;

use App\Models\AuditLog;

class AuditLogger
{
    public static function log(string $action, ?int $companyId = null, ?int $userId = null, ?string $subjectType = null, ?int $subjectId = null, array $meta = []): void
    {
        try {
            AuditLog::create([
                'company_id' => $companyId ?? (auth()->check() ? auth()->user()->company_id : null),
                'user_id' => $userId ?? (auth()->check() ? auth()->id() : null),
                'action' => $action,
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'meta' => $meta ?: null,
                'ip' => app()->bound('request') && request() ? request()->ip() : null,
            ]);
        } catch (\Throwable $e) {
            // Audit logging must never break the main flow.
        }
    }
}
