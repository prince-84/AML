"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { AuditLog } from "@/lib/types";
import { fmtDate, humanize, timeAgo } from "@/lib/format";
import { ButtonLink, Card, CardHeader, PageLoading, Pill, StatCard } from "@/components/ui";
import { IconPlus } from "@/components/icons";

interface DashData {
  customers_total: number;
  new_today: number;
  kyc_pending: number;
  open_screening_alerts: number;
  overdue_alerts: number;
  open_tm_alerts: number;
  open_cases: number;
  edd_due: number;
  high_risk_customers: number;
  screenings_today: number;
  screenings_total: number;
  potential_match_pct: number;
  screenings_by_day: { date: string; count: number }[];
  kyc: { pending: number; approved: number; rejected: number };
  screening_status: Record<string, number>;
  alerts_by_priority: { low: number; review: number; high: number };
  recent_activity: AuditLog[];
  pipeline: { engine?: string; worker?: string; lists_loaded?: number; last_sync?: string | null };
}

function num(...vals: unknown[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (v !== undefined && v !== null && !Number.isNaN(n)) return n;
  }
  return 0;
}

function normalize(raw: unknown): DashData {
  const d = (raw ?? {}) as Record<string, any>;
  const counts = (d.counts ?? {}) as Record<string, any>;
  const pick = (...keys: string[]) => num(...keys.map((k) => d[k] ?? counts[k]));

  const volRaw = (d.screening_volume ?? {}) as Record<string, any>;
  const byDayRaw = (d.screenings_by_day ?? volRaw.by_day ?? d.volume_by_day ?? []) as any[];
  const screenings_by_day = (Array.isArray(byDayRaw) ? byDayRaw : []).map((r) => ({
    date: String(r.date ?? r.day ?? ""),
    count: num(r.count, r.total, r.screenings),
  }));

  const kycRaw = (d.kyc_breakdown ?? d.kyc_status ?? d.kyc ?? {}) as Record<string, any>;
  const scrRaw = (d.screening_breakdown ?? d.screening_status_breakdown ?? d.screening_status ?? {}) as Record<string, any>;
  const prioRaw = (d.alerts_by_priority ?? {}) as Record<string, any>;
  const pipelineRaw = (d.pipeline ?? d.pipeline_status ?? {}) as Record<string, any>;

  return {
    customers_total: pick("customers_total", "total_customers"),
    new_today: pick("new_today", "customers_new_today"),
    kyc_pending: pick("kyc_pending", "kyc_waiting"),
    open_screening_alerts: pick("open_screening_alerts", "open_alerts"),
    overdue_alerts: pick("overdue_alerts", "alerts_overdue"),
    open_tm_alerts: pick("open_tm_alerts", "open_transaction_alerts"),
    open_cases: pick("open_cases", "active_cases"),
    edd_due: pick("edd_due"),
    high_risk_customers: pick("high_risk_customers", "high_risk"),
    screenings_today: pick("screenings_today"),
    screenings_total: pick("screenings_total", "total_screenings"),
    potential_match_pct: pick("potential_match_pct", "potential_match_percentage"),
    screenings_by_day,
    kyc: {
      pending: num(kycRaw.pending, d.kyc_pending),
      approved: num(kycRaw.approved),
      rejected: num(kycRaw.rejected),
    },
    screening_status: {
      not_screened: num(scrRaw.not_screened),
      clear: num(scrRaw.clear),
      potential_match: num(scrRaw.potential_match),
      under_review: num(scrRaw.under_review),
      confirmed_match: num(scrRaw.confirmed_match),
    },
    alerts_by_priority: {
      low: num(prioRaw.low),
      review: num(prioRaw.review),
      high: num(prioRaw.high),
    },
    recent_activity: (d.recent_activity ?? d.activity ?? []) as AuditLog[],
    pipeline: {
      engine: pipelineRaw.engine ?? pipelineRaw.engine_status ?? "Ready",
      worker: pipelineRaw.worker ?? pipelineRaw.worker_status ?? "Online",
      lists_loaded: num(pipelineRaw.lists_loaded, pipelineRaw.watchlist_entries, d.watchlist_entries),
      last_sync: pipelineRaw.last_sync ?? pipelineRaw.last_sync_at ?? null,
    },
  };
}

const ACTION_LABELS: Record<string, string> = {
  "customer.created": "Customer onboarded",
  "customer.kyc_approved": "KYC approved",
  "customer.kyc_rejected": "KYC rejected",
  "screening.performed": "Screening performed",
  "alert.decided": "Screening alert decided",
  "tm_alert.decided": "Transaction alert decided",
  "case.created": "Investigation case opened",
  "str.filed": "STR marked as filed",
  "str.created": "STR draft created",
  "settings.provider_updated": "Screening provider updated",
  "transaction.created": "Transaction recorded",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/dashboard")
      .then((raw) => setData(normalize(raw)))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the dashboard."));
  }, []);

  const chartMax = useMemo(
    () => Math.max(1, ...(data?.screenings_by_day.map((r) => r.count) ?? [0])),
    [data]
  );

  if (error) {
    return (
      <div className="rounded-xl border border-danger/25 bg-danger-soft px-5 py-4 text-[13px] text-danger">
        {error} Check that the ComplyShield API is running, then reload this page.
      </div>
    );
  }
  if (!data) return <PageLoading />;

  const kycTotal = data.kyc.pending + data.kyc.approved + data.kyc.rejected;
  const pendingPct = kycTotal > 0 ? (data.kyc.pending / kycTotal) * 360 : 0;
  const approvedPct = kycTotal > 0 ? (data.kyc.approved / kycTotal) * 360 : 0;
  const donut = `conic-gradient(#d97706 0deg ${pendingPct}deg, #15803d ${pendingPct}deg ${
    pendingPct + approvedPct
  }deg, #dc2626 ${pendingPct + approvedPct}deg 360deg)`;

  const screeningRows: [string, number, string][] = [
    ["Clear", data.screening_status.clear, "bg-ok"],
    ["Potential match", data.screening_status.potential_match, "bg-warn"],
    ["Under review", data.screening_status.under_review, "bg-warn"],
    ["Confirmed match", data.screening_status.confirmed_match, "bg-danger"],
    ["Not screened yet", data.screening_status.not_screened, "bg-slate-300"],
  ];
  const screeningTotal = Math.max(
    1,
    screeningRows.reduce((s, r) => s + r[1], 0)
  );
  const priorityTotal = Math.max(
    1,
    data.alerts_by_priority.low + data.alerts_by_priority.review + data.alerts_by_priority.high
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold text-ink">Compliance dashboard</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Live position across onboarding, screening and monitoring — updated{" "}
            {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/screening/name-checker" variant="outline">
            Run a name check
          </ButtonLink>
          <ButtonLink href="/customers/new">
            <IconPlus className="h-4 w-4" /> Add customer
          </ButtonLink>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Customers"
          value={data.customers_total.toLocaleString()}
          sub={`${data.new_today} new today`}
          href="/customers"
        />
        <StatCard
          label="KYC waiting"
          value={data.kyc_pending.toLocaleString()}
          sub="customers pending approval"
          tone="amber"
          href="/customers?kyc_status=pending"
        />
        <StatCard
          label="Open screening alerts"
          value={data.open_screening_alerts.toLocaleString()}
          sub={`${data.overdue_alerts} overdue`}
          tone={data.overdue_alerts > 0 ? "red" : "amber"}
          href="/screening/alerts"
        />
        <StatCard
          label="Open cases"
          value={data.open_cases.toLocaleString()}
          sub={`${data.open_tm_alerts} transaction alerts open`}
          tone="navy"
          href="/cases"
        />
        <StatCard
          label="High-risk customers"
          value={data.high_risk_customers.toLocaleString()}
          sub={`${data.edd_due} EDD reviews due`}
          tone="red"
          href="/risk/register"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Screening volume */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Screening volume — last 14 days"
            sub={`${data.screenings_total.toLocaleString()} screenings in total · ${data.screenings_today} today · ${data.potential_match_pct}% returned a potential match`}
            action={
              <Link href="/screening/monitor" className="text-[12.5px] font-medium text-primary hover:underline">
                Screening monitor
              </Link>
            }
          />
          <div className="px-5 py-5">
            {data.screenings_by_day.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-slate-400">
                No screening activity recorded in this period yet.
              </p>
            ) : (
              <div className="flex h-40 items-end gap-1.5 sm:gap-2">
                {data.screenings_by_day.map((r, i) => (
                  <div key={i} className="group flex flex-1 flex-col items-center gap-2">
                    <span className="text-[10.5px] font-medium tabular-nums text-slate-400 opacity-0 transition group-hover:opacity-100">
                      {r.count}
                    </span>
                    <div
                      className="w-full max-w-[34px] rounded-t-md bg-primary/85 transition group-hover:bg-primary"
                      style={{ height: `${Math.max(4, (r.count / chartMax) * 104)}px` }}
                      title={`${fmtDate(r.date)}: ${r.count} screenings`}
                    />
                    <span className="text-[10px] tabular-nums text-slate-400">
                      {r.date
                        ? new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).replace(" ", "\n")
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-x-6 gap-y-3 border-t border-line px-5 py-4 sm:grid-cols-2">
            {screeningRows.map(([label, value, dot]) => (
              <div key={label}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className={`h-2 w-2 rounded-full ${dot}`} /> {label}
                  </span>
                  <span className="font-medium tabular-nums text-ink">
                    {value.toLocaleString()} · {Math.round((value / screeningTotal) * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${dot}`} style={{ width: `${(value / screeningTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* KYC donut */}
        <Card>
          <CardHeader title="KYC status" sub="Customer due diligence pipeline" />
          <div className="flex items-center gap-5 px-5 py-5">
            <div className="relative h-[118px] w-[118px] shrink-0">
              <div className="h-full w-full rounded-full" style={{ background: kycTotal ? donut : "#e2e8f0" }} />
              <div className="absolute inset-[16px] flex flex-col items-center justify-center rounded-full bg-white">
                <span className="font-display text-[19px] font-bold leading-none text-ink tabular-nums">
                  {kycTotal}
                </span>
                <span className="mt-1 text-[10.5px] text-slate-400">customers</span>
              </div>
            </div>
            <ul className="space-y-2.5 text-[12.5px]">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-warn" /> Pending
                <span className="ml-auto pl-4 font-semibold tabular-nums text-ink">{data.kyc.pending}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-ok" /> Approved
                <span className="ml-auto pl-4 font-semibold tabular-nums text-ink">{data.kyc.approved}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-danger" /> Rejected
                <span className="ml-auto pl-4 font-semibold tabular-nums text-ink">{data.kyc.rejected}</span>
              </li>
            </ul>
          </div>
          <div className="border-t border-line px-5 py-4">
            <p className="text-[12.5px] leading-relaxed text-slate-500">
              Onboarding backlog is normal at this stage of the compliance programme: most customers
              are waiting on document verification before KYC can be approved.
            </p>
            <Link
              href="/identity-monitoring"
              className="mt-2 inline-block text-[12.5px] font-medium text-primary hover:underline"
            >
              Open identity monitoring
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Alerts by priority */}
        <Card>
          <CardHeader
            title="Open alerts by priority"
            sub="Screening alerts awaiting a decision"
            action={
              <Link href="/screening/alerts" className="text-[12.5px] font-medium text-primary hover:underline">
                Review alerts
              </Link>
            }
          />
          <div className="space-y-4 px-5 py-5">
            {(
              [
                ["High", data.alerts_by_priority.high, "bg-danger", "text-danger"],
                ["Review", data.alerts_by_priority.review, "bg-warn", "text-warn"],
                ["Low", data.alerts_by_priority.low, "bg-slate-400", "text-slate-500"],
              ] as const
            ).map(([label, value, bar, txt]) => (
              <div key={label}>
                <div className="flex items-baseline justify-between">
                  <span className={`text-[13px] font-medium ${txt}`}>{label} priority</span>
                  <span className="font-display text-[18px] font-bold tabular-nums text-ink">
                    {value.toLocaleString()}
                    <span className="ml-1.5 text-[11.5px] font-normal text-slate-400">
                      {Math.round((value / priorityTotal) * 100)}%
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${bar}`} style={{ width: `${(value / priorityTotal) * 100}%` }} />
                </div>
              </div>
            ))}
            <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-[12px] leading-relaxed text-warn">
              {data.overdue_alerts > 0
                ? `${data.overdue_alerts} alert${data.overdue_alerts === 1 ? " is" : "s are"} past the review deadline. High-priority alerts should be decided within 24 hours.`
                : "No alerts are past their review deadline. Keep high-priority alerts under 24 hours."}
            </p>
          </div>
        </Card>

        {/* Pipeline status */}
        <Card>
          <CardHeader title="Screening pipeline" sub="Engine and list status" />
          <ul className="divide-y divide-line px-5">
            <li className="flex items-center justify-between py-3.5">
              <span className="text-[13px] text-slate-600">Matching engine</span>
              <Pill tone="green">{humanize(String(data.pipeline.engine || "Ready"))}</Pill>
            </li>
            <li className="flex items-center justify-between py-3.5">
              <span className="text-[13px] text-slate-600">Screening worker</span>
              <Pill tone="green">{humanize(String(data.pipeline.worker || "Online"))}</Pill>
            </li>
            <li className="flex items-center justify-between py-3.5">
              <span className="text-[13px] text-slate-600">Watchlist entries loaded</span>
              <span className="font-medium tabular-nums text-ink">
                {(data.pipeline.lists_loaded || 0).toLocaleString()}
              </span>
            </li>
            <li className="flex items-center justify-between py-3.5">
              <span className="text-[13px] text-slate-600">Transaction monitoring</span>
              <Pill tone={data.open_tm_alerts > 0 ? "amber" : "green"}>
                {data.open_tm_alerts > 0 ? `${data.open_tm_alerts} alerts open` : "No alerts"}
              </Pill>
            </li>
            <li className="flex items-center justify-between py-3.5">
              <span className="text-[13px] text-slate-600">EDD reviews due</span>
              <span className="font-medium tabular-nums text-ink">{data.edd_due}</span>
            </li>
          </ul>
          <div className="px-5 pb-5">
            <Link
              href="/screening/configuration"
              className="text-[12.5px] font-medium text-primary hover:underline"
            >
              Manage screening providers
            </Link>
          </div>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader title="Recent activity" sub="Latest audited actions in this workspace" />
          {data.recent_activity.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-slate-400">
              No activity recorded yet. Actions such as onboarding, screening and alert decisions will
              appear here.
            </p>
          ) : (
            <ul className="divide-y divide-line px-5">
              {data.recent_activity.slice(0, 8).map((log) => (
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
