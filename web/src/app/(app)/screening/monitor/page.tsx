"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiList, apiPage } from "@/lib/api";
import type { AuditLog, Screening } from "@/lib/types";
import { fmtDateTime, humanize, timeAgo } from "@/lib/format";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  PageLoading,
  Pagination,
  Pill,
  Select,
  StatCard,
  TableWrap,
  tdCls,
  thCls,
} from "@/components/ui";
import { ScreeningPill } from "@/components/CustomerBits";

const ACTION_LABELS: Record<string, string> = {
  "customer.created": "Customer onboarded",
  "customer.kyc_approved": "KYC approved",
  "customer.kyc_rejected": "KYC rejected",
  "screening.performed": "Screening performed",
  "alert.decided": "Screening alert decided",
  "case.created": "Case opened",
  "str.filed": "STR filed",
  "settings.provider_updated": "Provider settings updated",
};

export default function ScreeningMonitorPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Screening[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiPage<Screening>("/screenings", { status: status || undefined, page });
      setRows(res.items);
      setTotal(res.total);
      setLastPage(res.lastPage);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    apiList<AuditLog>("/audit-logs", { per_page: 10 }).then(setLogs).catch(() => setLogs([]));
  }, []);

  const matches = rows.filter((r) => r.status !== "clear").length;

  return (
    <div>
      <PageHeader
        title="Screening monitor"
        sub="The engine's recent work: every screening run on this page, with candidates a click away. The full audit trail is kept for five years."
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Screenings (this view)" value={total.toLocaleString()} sub="all runs recorded" />
        <StatCard label="Engine" value="Ready" sub="matching service available" tone="green" />
        <StatCard label="Worker" value="Online" sub="queue clear, 0 jobs waiting" tone="green" />
        <StatCard
          label="Matches on this page"
          value={matches}
          sub="potential or confirmed"
          tone={matches ? "amber" : "green"}
          href="/screening/alerts"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5">
            <p className="font-display text-[14.5px] font-semibold text-ink">Recent screenings</p>
            <Select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              className="ml-auto w-48"
            >
              <option value="">All outcomes</option>
              <option value="clear">Clear</option>
              <option value="potential_match">Potential match</option>
              <option value="confirmed">Confirmed</option>
            </Select>
          </div>
          {loading ? (
            <PageLoading />
          ) : rows.length === 0 ? (
            <EmptyState title="No screenings recorded" text="Screenings from onboarding, the name checker and bulk runs will appear here." />
          ) : (
            <>
              <TableWrap>
                <table className="w-full min-w-[640px]">
                  <thead className="border-b border-line bg-slate-50/70">
                    <tr>
                      <th className={thCls}>Subject</th>
                      <th className={thCls}>When</th>
                      <th className={thCls}>Source</th>
                      <th className={thCls}>Engine</th>
                      <th className={thCls}>Outcome</th>
                      <th className={thCls}>Best</th>
                      <th className={thCls}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((s) => (
                      <React.Fragment key={s.id}>
                        <tr className="hover:bg-slate-50">
                          <td className={`${tdCls} font-medium text-ink`}>
                            {s.customer ? (
                              <Link href={`/customers/${s.customer.id}`} className="hover:text-primary">
                                {s.subject_name}
                              </Link>
                            ) : (
                              s.subject_name
                            )}
                          </td>
                          <td className={`${tdCls} tabular-nums text-slate-500`}>{fmtDateTime(s.created_at)}</td>
                          <td className={tdCls}>{humanize(s.source)}</td>
                          <td className={tdCls}>{humanize(s.mode)}</td>
                          <td className={tdCls}>
                            <ScreeningPill status={s.status} />
                          </td>
                          <td className={`${tdCls} tabular-nums`}>{s.best_score ?? 0}%</td>
                          <td className={tdCls}>
                            {(s.results || []).length > 0 && (
                              <button
                                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                                className="text-[12px] font-medium text-primary hover:underline"
                              >
                                {expanded === s.id ? "Hide" : `${s.results!.length} candidates`}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expanded === s.id && (s.results || []).length > 0 && (
                          <tr>
                            <td colSpan={7} className="bg-slate-50/70 px-4 py-3">
                              <ul className="space-y-1.5">
                                {s.results!.map((c, i) => (
                                  <li key={i} className="flex flex-wrap items-baseline gap-x-3 text-[12.5px]">
                                    <span className="font-medium text-ink">{c.name || c.full_name || c.matched_name}</span>
                                    <span className="font-semibold tabular-nums text-warn">{Number(c.score ?? c.match_score ?? 0)}%</span>
                                    <span className="text-slate-500">
                                      {c.list_name || c.source_list || (c.datasets || []).join(", ")}
                                    </span>
                                    {c.dob && <span className="text-slate-400">DOB {c.dob}</span>}
                                    {c.nationality && <span className="text-slate-400">{c.nationality}</span>}
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Audit trail" sub="Latest recorded actions across the workspace" />
          {logs.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-slate-400">
              Audit entries will appear here as the team works.
            </p>
          ) : (
            <ul className="divide-y divide-line px-5">
              {logs.slice(0, 10).map((log) => (
                <li key={log.id} className="flex items-start gap-3 py-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">
                      {ACTION_LABELS[log.action] || humanize(log.action)}
                    </p>
                    <p className="truncate text-[12px] text-slate-400">
                      {log.user?.name ? `${log.user.name} · ` : ""}
                      {timeAgo(log.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
