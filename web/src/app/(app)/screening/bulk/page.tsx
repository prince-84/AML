"use client";

import React, { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { humanize } from "@/lib/format";
import { Button, Card, PageHeader, Pill, Spinner, TableWrap, Textarea, tdCls, thCls } from "@/components/ui";

interface BulkRow {
  name?: string;
  subject_name?: string;
  dob?: string | null;
  nationality?: string | null;
  status?: string;
  best_score?: number | null;
  candidates_count?: number;
  mode?: string;
}

interface BulkResult {
  summary: { total: number; clear: number; matches: number };
  rows: BulkRow[];
  note?: string | null;
}

function normalize(raw: unknown): BulkResult {
  const d = (raw ?? {}) as Record<string, any>;
  const rows = (d.results ?? d.rows ?? d.screenings ?? []) as BulkRow[];
  const s = (d.summary ?? {}) as Record<string, any>;
  const matches = rows.filter((r) => r.status !== "clear").length;
  return {
    summary: {
      total: Number(s.total ?? s.screened ?? rows.length),
      clear: Number(s.clear ?? rows.length - matches),
      matches: Number(s.matches ?? s.potential_matches ?? matches),
    },
    rows,
    note: d.note ?? null,
  };
}

const SAMPLE = `name,dob,nationality
Aneesh Doshi,1972-08-20,United States
Fatima Noor Al Sayegh,1991-04-12,United Arab Emirates
Dmitri Volkov,1985-11-02,Russia`;

export default function BulkScreeningPage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
    toast(`Loaded ${file.name}. Review the rows, then run the screening.`);
  };

  const run = async () => {
    if (!csv.trim()) {
      toast("Paste CSV rows or upload a file first.", "error");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const raw = await api("/screening/bulk", { method: "POST", body: { csv } });
      setResult(normalize(raw));
      toast("Bulk screening complete. Every row has been saved to the screening history.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Bulk screening failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Bulk screening"
        sub="Screen a whole list at once — a customer book, a supplier list or a branch's walk-ins for the week. One CSV with a name per row."
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-ink">
            CSV format: <span className="font-mono text-[12px] text-slate-500">name,dob,nationality</span>
            <span className="ml-2 font-normal text-slate-400">Date of birth and nationality are optional per row.</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCsv(SAMPLE)}>
              Insert sample rows
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Upload .csv file
            </Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={onFile} />
          </div>
        </div>
        <Textarea
          rows={9}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={"name,dob,nationality\nAhmed Saleh,1988-03-14,Yemen\n…"}
          className="mt-3 font-mono text-[12.5px]"
        />
        <div className="mt-4 flex items-center gap-3">
          <Button disabled={busy} onClick={run}>
            {busy ? (
              <>
                <Spinner className="h-4 w-4 text-white" /> Screening rows…
              </>
            ) : (
              "Screen all rows"
            )}
          </Button>
          <p className="text-[12px] text-slate-400">
            Rows are screened against the local lists; with an OpenSanctions key configured, live data is
            used for up to 25 rows per run.
          </p>
        </div>
      </Card>

      {result && (
        <Card className="mt-4">
          <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
            <p className="font-display text-[15px] font-semibold text-ink">Results</p>
            <span className="text-[12.5px] text-slate-500">
              {result.summary.total} screened · {result.summary.clear} clear ·{" "}
              <span className={result.summary.matches > 0 ? "font-medium text-warn" : ""}>
                {result.summary.matches} need review
              </span>
            </span>
            {result.note && <span className="text-[12px] text-warn">{result.note}</span>}
          </div>
          <TableWrap>
            <table className="w-full min-w-[560px]">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={thCls}>Name</th>
                  <th className={thCls}>Date of birth</th>
                  <th className={thCls}>Nationality</th>
                  <th className={thCls}>Result</th>
                  <th className={thCls}>Best score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className={`${tdCls} font-medium text-ink`}>{r.name || r.subject_name}</td>
                    <td className={`${tdCls} tabular-nums`}>{r.dob || "—"}</td>
                    <td className={tdCls}>{r.nationality || "—"}</td>
                    <td className={tdCls}>
                      <Pill tone={r.status === "clear" ? "green" : r.status === "confirmed" ? "red" : "amber"}>
                        {humanize(r.status)}
                      </Pill>
                    </td>
                    <td className={`${tdCls} tabular-nums`}>{r.best_score ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <p className="px-5 py-3.5 text-[12px] text-slate-400">
            Rows that matched are also in Screening Alerts where a customer record exists; one-off names
            stay in the screening history under Screening Monitor.
          </p>
        </Card>
      )}
    </div>
  );
}
