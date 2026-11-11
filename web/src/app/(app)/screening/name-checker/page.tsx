"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import type { Candidate, Screening } from "@/lib/types";
import { useToast } from "@/lib/toast";
import { Button, Card, Field, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { NATIONALITIES } from "@/components/CustomerBits";
import { ScreeningResultView } from "@/components/CandidateResults";

const TEST_CHIPS = ["Osama Bin Laden", "Anish Doshi", "Vladimir Putin"];

interface Result {
  status: string;
  bestScore?: number | null;
  mode?: string | null;
  durationMs?: number | null;
  note?: string | null;
  candidates: Candidate[];
}

function normalize(raw: unknown): Result {
  const d = (raw ?? {}) as Record<string, any>;
  const s = (d.screening ?? {}) as Record<string, any>;
  const candidates = (d.candidates ?? d.results ?? s.results ?? []) as Candidate[];
  return {
    status: String(s.status ?? d.status ?? (candidates.length ? "potential_match" : "clear")),
    bestScore: s.best_score ?? d.best_score ?? d.bestScore ?? (candidates.length ? Number(candidates[0]?.score ?? candidates[0]?.match_score ?? 0) : 0),
    mode: s.mode ?? d.mode ?? null,
    durationMs: s.duration_ms ?? d.duration_ms ?? null,
    note: s.note ?? d.note ?? null,
    candidates,
  };
}

export default function NameCheckerPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"check" | "test">("check");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = async (endpoint: string, subjectName: string) => {
    if (!subjectName.trim()) {
      toast("Enter a name to screen.", "error");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const raw = await api<Screening | Record<string, unknown>>(endpoint, {
        method: "POST",
        body: {
          name: subjectName.trim(),
          dob: dob || undefined,
          nationality: nationality || undefined,
          ...(endpoint.includes("name-check") ? { save: true } : {}),
        },
      });
      setResult(normalize(raw));
    } catch (err) {
      toast(err instanceof Error ? err.message : "The screening could not be completed.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Name checker"
        sub="Screen any name against the loaded sanctions, terrorist, PEP and exclusion lists. Add a date of birth or nationality to sharpen the match."
      />

      <div className="mb-4 flex gap-1 border-b border-line">
        <button
          onClick={() => {
            setTab("check");
            setResult(null);
          }}
          className={`px-3.5 py-2.5 text-[13px] font-medium ${tab === "check" ? "border-b-2 border-primary text-primary-dark" : "text-slate-500 hover:text-ink"}`}
        >
          Name Checker
        </button>
        <button
          onClick={() => {
            setTab("test");
            setResult(null);
          }}
          className={`px-3.5 py-2.5 text-[13px] font-medium ${tab === "test" ? "border-b-2 border-primary text-primary-dark" : "text-slate-500 hover:text-ink"}`}
        >
          Test screening
        </button>
      </div>

      <Card className="p-5">
        {tab === "test" && (
          <div className="mb-4 rounded-lg bg-page px-3.5 py-3 text-[12.5px] leading-relaxed text-slate-500">
            Test screening runs a name against the same lists to check your setup.{" "}
            <strong className="text-ink">Nothing is saved</strong> and no customer alert is raised — use
            Name Checker for real screening. Try one of the sample names:
            <span className="mt-2 flex flex-wrap gap-1.5">
              {TEST_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setName(chip)}
                  className="rounded-full border border-line bg-white px-2.5 py-1 text-[12px] font-medium text-ink transition hover:border-primary/50 hover:text-primary-dark"
                >
                  {chip}
                </button>
              ))}
            </span>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-[1fr_170px_210px]">
          <Field label="Full name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. the name exactly as on the ID"
              onKeyDown={(e) => {
                if (e.key === "Enter") void run(tab === "test" ? "/screening/test" : "/screening/name-check", name);
              }}
            />
          </Field>
          <Field label="Date of birth (optional)">
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label="Nationality (optional)">
            <Select value={nationality} onChange={(e) => setNationality(e.target.value)}>
              <option value="">Any nationality</option>
              {NATIONALITIES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            disabled={busy}
            onClick={() => run(tab === "test" ? "/screening/test" : "/screening/name-check", name)}
          >
            {busy ? (
              <>
                <Spinner className="h-4 w-4 text-white" /> Screening…
              </>
            ) : tab === "test" ? (
              "Run test screening"
            ) : (
              "Screen this name"
            )}
          </Button>
          <p className="text-[12px] text-slate-400">
            {tab === "test"
              ? "Uses OpenSanctions live data when an API key is configured; otherwise the local lists."
              : "The check is saved to the screening history and counts toward your monthly credits when live data is used."}
          </p>
        </div>

        {result && (
          <div className="mt-6 border-t border-line pt-5">
            <ScreeningResultView
              status={result.status}
              bestScore={result.bestScore}
              mode={result.mode}
              durationMs={result.durationMs}
              note={result.note}
              candidates={result.candidates}
            />
          </div>
        )}
      </Card>

      <p className="mt-4 text-[12px] leading-relaxed text-slate-400">
        Matching is fuzzy and phonetic, and understands Arabic name spellings, so small differences
        between the ID and the list entry still surface. A high score is a prompt to compare
        identifiers — it is not, on its own, proof that this is the listed person.
      </p>
    </div>
  );
}
