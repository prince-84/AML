"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiPage } from "@/lib/api";
import type { ScreeningAlert } from "@/lib/types";
import { alertStatusTone, fmtDate, isOverdue, priorityTone, humanize } from "@/lib/format";
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
import { ScreeningAlertDecisionModal } from "@/components/DecisionModals";

export default function ScreeningAlertsPage() {
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ScreeningAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [decide, setDecide] = useState<ScreeningAlert | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiPage<ScreeningAlert>("/alerts", {
        status: status || undefined,
        priority: priority || undefined,
        page,
      });
      setRows(res.items);
      setTotal(res.total);
      setLastPage(res.lastPage);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, priority, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Screening alerts"
        sub="Names that matched a list at or above the threshold. Compare identifiers before deciding — most matches are false positives, but every one needs a recorded decision."
      />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3.5">
          <Select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="w-52"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="under_review">Under review</option>
            <option value="cleared_false_positive">Cleared — false positive</option>
            <option value="confirmed_match">Confirmed match</option>
            <option value="escalated">Escalated</option>
          </Select>
          <Select
            value={priority}
            onChange={(e) => {
              setPage(1);
              setPriority(e.target.value);
            }}
            className="w-44"
          >
            <option value="">Any priority</option>
            <option value="high">High</option>
            <option value="review">Review</option>
            <option value="low">Low</option>
          </Select>
        </div>
        {loading ? (
          <PageLoading />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No alerts with these filters"
            text="When a customer screening finds a match, the alert appears here with a 24-hour decision deadline for high priority."
          />
        ) : (
          <>
            <TableWrap>
              <table className="w-full min-w-[900px]">
                <thead className="border-b border-line bg-slate-50/70">
                  <tr>
                    <th className={thCls}>Customer</th>
                    <th className={thCls}>Matched name</th>
                    <th className={thCls}>List</th>
                    <th className={thCls}>Score</th>
                    <th className={thCls}>Priority</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Decision due</th>
                    <th className={thCls}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className={tdCls}>
                        {a.customer ? (
                          <Link href={`/customers/${a.customer.id}`} className="font-medium text-ink hover:text-primary">
                            {a.customer.full_name}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Customer #{a.customer_id}</span>
                        )}
                        <span className="block text-[12px] text-slate-400">Alert #{a.id}</span>
                      </td>
                      <td className={`${tdCls} font-medium text-ink`}>{a.matched_name}</td>
                      <td className={`${tdCls} max-w-[200px]`}>
                        <span className="line-clamp-2">{a.list_name}</span>
                      </td>
                      <td className={tdCls}>
                        <span className={`font-display text-[15px] font-bold tabular-nums ${a.match_score >= 90 ? "text-danger" : "text-warn"}`}>
                          {a.match_score}%
                        </span>
                      </td>
                      <td className={tdCls}>
                        <Pill tone={priorityTone(a.priority)}>{humanize(a.priority)}</Pill>
                      </td>
                      <td className={tdCls}>
                        <Pill tone={alertStatusTone(a.status)}>{humanize(a.status)}</Pill>
                      </td>
                      <td className={`${tdCls} tabular-nums ${isOverdue(a.due_at, a.status) ? "font-medium text-danger" : "text-slate-500"}`}>
                        {a.due_at ? fmtDate(a.due_at) : "—"}
                        {isOverdue(a.due_at, a.status) && <span className="block text-[11.5px]">overdue</span>}
                      </td>
                      <td className={tdCls}>
                        {["open", "under_review"].includes(a.status) ? (
                          <Button size="sm" variant="outline" onClick={() => setDecide(a)}>
                            Decide
                          </Button>
                        ) : (
                          <span className="text-[12px] text-slate-400">{a.decision_notes || "Decided"}</span>
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

      <ScreeningAlertDecisionModal alert={decide} onClose={() => setDecide(null)} onDone={load} />
    </div>
  );
}
