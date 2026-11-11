<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomerDocument;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    public function verify(Request $request, CustomerDocument $document)
    {
        $data = $request->validate([
            'checklist' => ['sometimes', 'array'],
            'checklist.*' => ['in:pending,verified,failed'],
            'verified' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['checklist'])) {
            $current = $document->verification ?? [];
            $document->verification = array_merge($current, $data['checklist']);
        }
        $checklist = $document->verification ?? [];
        $allVerified = $checklist && collect($checklist)->every(fn ($v) => $v === 'verified');

        $document->verified = array_key_exists('verified', $data) ? (bool) $data['verified'] : $allVerified;
        if ($document->verified) {
            $document->verified_by = $request->user()->id;
            $document->verified_at = now();
        } else {
            $document->verified_by = null;
            $document->verified_at = null;
        }
        $document->save();

        return ApiResponse::ok(['document' => $document], 'Document verification updated.');
    }
}
