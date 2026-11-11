"use client";

import React from "react";
import type { Candidate } from "@/lib/types";
import { fmtDate, humanize } from "@/lib/format";
import { Pill, TableWrap, tdCls, thCls } from "./ui";

export function candidateLists(c: Candidate): string {
  if (c.list_name) return c.list_name;
  if (c.source_list) return c.source_list;
  if (c.datasets && c.datasets.length) return c.datasets.join(", ");
  return "Watchlist";
}

export function ScreeningResultView({
  status,
  bestScore,
  mode,
  durationMs,
  note,
  candidates,
}: {
  status: string;
  bestScore?: number | null;
  mode?: string | null;
  durationMs?: number | null;
  note?: string | null;
  candidates: Candidate[];
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={status === "clear" ? "green" : status === "confirmed" ? "red" : "amber"}>
          {status === "clear" ? "Clear — no match" : status === "confirmed" ? "Confirmed match" : "Potential match"}
        </Pill>
        <span className="text-[12.5px] text-slate-500">
          {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
          {typeof bestScore === "number" ? ` · best score ${bestScore}%` : ""}
          {mode ? ` · ${humanize(mode)} engine` : ""}
          {durationMs ? ` · ${durationMs} ms` : ""}
        </span>
      </div>
      {note && (
        <p className="mt-3 rounded-lg bg-warn-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warn">{note}</p>
      )}
      {candidates.length === 0 ? (
        <p className="mt-4 rounded-lg bg-ok-soft px-4 py-3 text-[13px] leading-relaxed text-ok">
          Nothing reached the similarity threshold. This name is clear against the lists used for this
          check — keep the result with the customer file as evidence of the check.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-line">
          <TableWrap>
            <table className="w-full min-w-[560px]">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={thCls}>Listed person / entity</th>
                  <th className={thCls}>Score</th>
                  <th className={thCls}>On lists</th>
                  <th className={thCls}>Identifiers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {candidates.map((c, i) => {
                  const score = Number(c.score ?? c.match_score ?? 0);
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className={`${tdCls} font-medium text-ink`}>
                        {c.name || c.full_name || c.matched_name || "Unknown"}
                        {c.caption && <span className="block text-[12px] font-normal text-slate-400">{c.caption}</span>}
                        {c.summary && <span className="mt-0.5 line-clamp-2 block text-[12px] font-normal text-slate-400">{c.summary}</span>}
                        {(c.aliases || []).length > 0 && (
                          <span className="block text-[12px] font-normal text-slate-400">
                            Aliases: {(c.aliases || []).slice(0, 4).join(", ")}
                          </span>
                        )}
                      </td>
                      <td className={tdCls}>
                        <span className={`font-display text-[16px] font-bold tabular-nums ${score >= 90 ? "text-danger" : score >= 70 ? "text-warn" : "text-slate-600"}`}>
                          {score}%
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          {score >= 90 ? "Flagged as a match" : "Possible match"}
                        </span>
                      </td>
                      <td className={`${tdCls} max-w-[230px]`}>
                        <span className="line-clamp-3">{candidateLists(c)}</span>
                        {(c.programmes || []).length > 0 && (
                          <span className="block text-[12px] text-slate-400">{(c.programmes || []).join(", ")}</span>
                        )}
                      </td>
                      <td className={`${tdCls} text-slate-500`}>
                        {c.dob ? `Born ${fmtDate(c.dob)}` : ""}
                        {c.nationality ? <span className="block">{c.nationality}</span> : null}
                        {(c.topics || []).length > 0 && (
                          <span className="block text-[12px]">{(c.topics || []).map((t) => humanize(t)).join(", ")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}
    </div>
  );
}
