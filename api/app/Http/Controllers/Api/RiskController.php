<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RiskAssessment;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class RiskController extends Controller
{
    public function index()
    {
        return ApiResponse::ok(['assessments' => RiskAssessment::latest()->get()]);
    }

    public function store(Request $request)
    {
        $data = $this->validateScores($request);
        $data['company_id'] = $request->user()->company_id;
        $data['created_by'] = $request->user()->id;
        [$data['inherent_score'], $data['residual_score']] = $this->computeScores($data);
        $assessment = RiskAssessment::create($data);
        return ApiResponse::ok(['assessment' => $assessment], 'Assessment created.', 201);
    }

    public function update(Request $request, RiskAssessment $riskAssessment)
    {
        $data = $this->validateScores($request, true);
        if (isset($data['status']) && $data['status'] === 'approved') {
            $data['approved_by'] = $request->user()->id;
        }
        $merged = array_merge($riskAssessment->toArray(), $data);
        [$inherent, $residual] = $this->computeScores($merged);
        $data['inherent_score'] = $inherent;
        $data['residual_score'] = $residual;
        $riskAssessment->update($data);
        return ApiResponse::ok(['assessment' => $riskAssessment->fresh()], 'Assessment updated.');
    }

    private function validateScores(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';
        return $request->validate([
            'title' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'period' => ['nullable', 'string', 'max:60'],
            'status' => ['sometimes', 'in:draft,in_review,approved'],
            'customer_score' => [$req, 'integer', 'min:0', 'max:100'],
            'products_score' => [$req, 'integer', 'min:0', 'max:100'],
            'channels_score' => [$req, 'integer', 'min:0', 'max:100'],
            'geography_score' => [$req, 'integer', 'min:0', 'max:100'],
            'counterparty_score' => [$req, 'integer', 'min:0', 'max:100'],
            'methodology_note' => ['nullable', 'string'],
        ]);
    }

    /** Inherent = mean of the five dimensions; residual assumes controls mitigate 40%. */
    private function computeScores(array $d): array
    {
        $dims = [
            (int) ($d['customer_score'] ?? 0), (int) ($d['products_score'] ?? 0),
            (int) ($d['channels_score'] ?? 0), (int) ($d['geography_score'] ?? 0),
            (int) ($d['counterparty_score'] ?? 0),
        ];
        $inherent = (int) round(array_sum($dims) / 5);
        $residual = (int) round($inherent * 0.6);
        return [$inherent, $residual];
    }
}
