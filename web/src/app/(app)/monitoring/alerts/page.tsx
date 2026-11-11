"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiPage } from "@/lib/api";
import type { TmAlert } from "@/lib/types";
import { fmtDateTime, humanize, severityTone } from "@/lib/format";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageLoading,
  Pagination,
  Pill,
  Select,
  TableWrap,
  tdCls,
  thCls,
} from "@/components/ui";
import { TmAlertDecisionModal } from "@/components/DecisionModals";

const statusTone = (s: string) =>
  s === "open" ? "red" : s === "under_review" ? "amber" : s === "escalated_to_case" ? "navy" : "green";

export default function TmAlertsPage() {
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<TmAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [decide, setDecide] = useState<TmAlert | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiPage<TmAlert>("/tm-alerts", { status: status || undefined, page });
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

  return (
    <div>
      <PageHeader
        title="Transaction alerts"
        sub="Behaviour the rules flagged: large cash, structuring patterns, rapid succession and high-risk customers. Close what is explained; escalate the rest."
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5">
          <Select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="w-56"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="under_review">Under review</option>
            <option value="closed_benign">Closed — benign</option>
            <option value="escalated_to_case">Escalated to case</option>
          </Select>
          <span className="text-[12.5px] text-slate-400">
            Cash of AED 55,000+ and structured cash just below it are the most common triggers in jewellery.
          </span>
        </div>
        {loading ? (
          <PageLoading />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No alerts with this status"
            text="When the monitoring rules flag a transaction, the alert lands here for a decision."
          />
        ) : (
          <>
            <TableWrap>
              <table className="w-full min-w-[860px]">
                <thead className="border-b border-line bg-slate-50/70">
                  <tr>
                    <th className={thCls}>Alert</th>
                    <th className={thCls}>Customer</th>
                    <th className={thCls}>Rule</th>
                    <th className={thCls}>Severity</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Raised</th>
                    <th className={thCls}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className={`${tdCls} max-w-[320px]`}>
                        <span className="font-medium text-ink">{a.title}</span>
                        {a.description && (
                          <span className="mt-0.5 line-clamp-2 block text-[12px] text-slate-400">{a.description}</span>
                        )}
                      </td>
                      <td className={tdCls}>
                        {a.customer ? (
                          <Link href={`/customers/${a.customer.id}`} className="font-medium text-ink hover:text-primary">
                            {a.customer.full_name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${tdCls} font-mono text-[11.5px] text-slate-500`}>{a.rule_code}</td>
                      <td className={tdCls}>
                        <Pill tone={severityTone(a.severity)}>{humanize(a.severity)}</Pill>
                      </td>
                      <td className={tdCls}>
                        <Pill tone={statusTone(a.status)}>{humanize(a.status)}</Pill>
                      </td>
                      <td className={`${tdCls} tabular-nums text-slate-500`}>{fmtDateTime(a.created_at)}</td>
                      <td className={tdCls}>
                        {["open", "under_review"].includes(a.status) ? (
                          <Button size="sm" variant="outline" onClick={() => setDecide(a)}>
                            Decide
                          </Button>
                        ) : (
                          <span className="text-[12px] text-slate-400">{a.notes || "Decided"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
          </>
        )}
      </Card>

      <TmAlertDecisionModal alert={decide} onClose={() => setDecide(null)} onDone={load} />
    </div>
  );
}
