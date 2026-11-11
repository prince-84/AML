"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Company, UsageRow } from "@/lib/types";
import { fmtDate, humanize } from "@/lib/format";
import { Card, CardHeader, EmptyState, PageHeader, PageLoading, Pill, StatCard, TableWrap, tdCls, thCls } from "@/components/ui";

const PLAN_CREDITS: Record<string, number> = { starter: 250, growth: 1000, enterprise: 5000 };

export default function UsageSettingsPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Company>("/settings/company").catch(() => null),
      api<unknown>("/settings/usage")
        .then((d) => {
          const dd = (d ?? {}) as Record<string, any>;
          if (Array.isArray(d)) return d as UsageRow[];
          return (dd.usage ?? dd.rows ?? dd.data ?? []) as UsageRow[];
        })
        .catch(() => [] as UsageRow[]),
    ]).then(([c, u]) => {
      setCompany(c);
      setRows(u);
      setLoading(false);
    });
  }, []);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRows = useMemo(() => rows.filter((r) => r.month === thisMonth), [rows, thisMonth]);
  const monthCredits = monthRows.reduce((s, r) => s + Number(r.credits || 0), 0);
  const monthCalls = monthRows.reduce((s, r) => s + Number(r.calls || 0), 0);
  const used = typeof company?.screening_credits_used === "number" ? company.screening_credits_used : monthCredits;
  const allowance = PLAN_CREDITS[(company?.plan || "starter").toLowerCase()] || 250;
  const pct = Math.min(100, Math.round((used / allowance) * 100));

  const byMonth = useMemo(() => {
    const map = new Map<string, { calls: number; credits: number; providers: Set<string> }>();
    rows.forEach((r) => {
      const cur = map.get(r.month) || { calls: 0, credits: 0, providers: new Set<string>() };
      cur.calls += Number(r.calls || 0);
      cur.credits += Number(r.credits || 0);
      cur.providers.add(r.provider);
      map.set(r.month, cur);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  const monthLabel = (m: string) => {
    const d = new Date(`${m}-01T00:00:00`);
    return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  };

  if (loading) return <PageLoading />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Subscription & usage"
        sub="Your plan, the screening credits it includes, and what your workspace has actually consumed."
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Current plan"
          value={<span className="capitalize">{company?.plan || "Starter"}</span>}
          sub={`renews ${fmtDate(company?.plan_expires_at)}`}
          tone="navy"
        />
        <StatCard label="Credits used this month" value={used.toLocaleString()} sub={`of ${allowance.toLocaleString()} included`} tone={pct > 85 ? "red" : "teal"} />
        <StatCard label="API calls this month" value={monthCalls.toLocaleString()} sub="OpenSanctions live checks" />
        <StatCard label="Months on record" value={byMonth.length} sub="usage history below" tone="slate" />
      </div>

      <Card className="mt-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13.5px] font-medium text-ink">Monthly screening credit usage</p>
          <Pill tone={pct > 85 ? "red" : pct > 60 ? "amber" : "green"}>{pct}% used</Pill>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${pct > 85 ? "bg-danger" : pct > 60 ? "bg-warn" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-slate-500">
          Credits are spent only when a check uses live OpenSanctions data — local list checks are
          unlimited and free. One credit covers one name check, whether it comes back clear or matched.
          If you reach the allowance, screening continues on the local lists and live checks resume next
          month or on upgrade.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Object.entries(PLAN_CREDITS).map(([plan, credits]) => (
            <div
              key={plan}
              className={`rounded-xl border p-4 ${company?.plan === plan ? "border-primary bg-primary-soft/50" : "border-line"}`}
            >
              <p className="flex items-center justify-between font-display text-[14px] font-semibold capitalize text-ink">
                {plan}
                {company?.plan === plan && <Pill tone="teal" dot={false}>Current</Pill>}
              </p>
              <p className="mt-1 text-[12.5px] text-slate-500">
                {credits.toLocaleString()} live screening credits / month
              </p>
              <p className="mt-1 text-[12px] text-slate-400">
                {plan === "starter"
                  ? "For a single counter getting compliant."
                  : plan === "growth"
                    ? "For multi-branch businesses with steady onboarding."
                    : "For groups, exchanges and audit firms screening at volume."}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-slate-400">
          To change plan, contact ComplyShield support — plan changes take effect from the next billing
          cycle and never interrupt screening.
        </p>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Usage history" sub="Live-data calls and credits by month, as counted by the workspace (the provider's invoice is the final figure)" />
        {byMonth.length === 0 ? (
          <EmptyState
            title="No live-data usage yet"
            text="Usage appears here once screenings run against OpenSanctions with an API key configured. Local-list screening is unlimited and is not metered."
          />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[520px]">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={thCls}>Month</th>
                  <th className={thCls}>Providers</th>
                  <th className={thCls}>API calls</th>
                  <th className={thCls}>Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {byMonth.map(([month, agg]) => (
                  <tr key={month} className="hover:bg-slate-50">
                    <td className={`${tdCls} font-medium text-ink`}>
                      {monthLabel(month)}
                      {month === thisMonth && <span className="ml-2 text-[11.5px] font-normal text-primary">current</span>}
                    </td>
                    <td className={tdCls}>{[...agg.providers].map(humanize).join(", ")}</td>
                    <td className={`${tdCls} tabular-nums`}>{agg.calls.toLocaleString()}</td>
                    <td className={`${tdCls} font-medium tabular-nums text-ink`}>{agg.credits.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
