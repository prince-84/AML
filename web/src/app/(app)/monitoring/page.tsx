"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, apiList } from "@/lib/api";
import type { TmAlert, TmRule } from "@/lib/types";
import { humanize, severityTone } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { Button, Card, CardHeader, PageHeader, PageLoading, Pill, StatCard } from "@/components/ui";

export default function MonitoringPage() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<TmAlert[]>([]);
  const [rules, setRules] = useState<TmRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        apiList<TmAlert>("/tm-alerts", { per_page: 200 }).catch(() => []),
        apiList<TmRule>("/tm-rules").catch(() => []),
      ]);
      setAlerts(a);
      setRules(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = alerts.filter((a) => ["open", "under_review"].includes(a.status));
  const runMonitor = async () => {
    setRunning(true);
    try {
      const res = await api<{ alerts_created?: number; created?: number }>("/transactions/run-monitor", {
        method: "POST",
      });
      const created = res?.alerts_created ?? res?.created ?? 0;
      toast(
        created > 0
          ? `Monitoring run complete: ${created} new alert${created === 1 ? "" : "s"} raised.`
          : "Monitoring run complete: no new alerts raised."
      );
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Monitoring run failed.", "error");
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <PageLoading />;

  const byRule = new Map<string, number>();
  open.forEach((a) => byRule.set(a.rule_code, (byRule.get(a.rule_code) || 0) + 1));

  return (
    <div>
      <PageHeader
        title="Transaction monitoring"
        sub="Rules run on every transaction as it is recorded. Use a manual run after importing or back-dating transactions."
        actions={
          <Button onClick={runMonitor} disabled={running}>
            {running ? "Scanning all transactions…" : "Run monitor"}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Open alerts" value={open.length} sub="awaiting a decision" tone={open.length ? "amber" : "green"} href="/monitoring/alerts" />
        <StatCard
          label="High severity"
          value={open.filter((a) => a.severity === "high").length}
          sub="cash threshold & structuring"
          tone="red"
          href="/monitoring/alerts"
        />
        <StatCard
          label="Rules active"
          value={`${rules.filter((r) => r.is_enabled).length} of ${rules.length}`}
          sub="configured under Rules"
          href="/monitoring/rules"
        />
        <StatCard
          label="Escalated to cases"
          value={alerts.filter((a) => a.status === "escalated_to_case").length}
          sub="all time"
          tone="navy"
          href="/cases"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Alerts by rule" sub="Open alerts grouped by the rule that raised them" />
          {rules.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-slate-400">No monitoring rules configured.</p>
          ) : (
            <ul className="divide-y divide-line px-5">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3.5">
                  <div>
                    <p className="text-[13.5px] font-medium text-ink">{r.name}</p>
                    <p className="text-[12px] text-slate-400">
                      {r.code} · {r.is_enabled ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.severity && <Pill tone={severityTone(r.severity)}>{humanize(r.severity)}</Pill>}
                    <span className="min-w-8 text-right font-display text-[16px] font-bold tabular-nums text-ink">
                      {byRule.get(r.code) || 0}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Latest open alerts"
            sub="Most recent activity the rules picked up"
            action={
              <Link href="/monitoring/alerts" className="text-[12.5px] font-medium text-primary hover:underline">
                All alerts
              </Link>
            }
          />
          {open.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-slate-400">
              No open alerts. The rules are running and nothing currently needs a decision.
            </p>
          ) : (
            <ul className="divide-y divide-line px-5">
              {open.slice(0, 6).map((a) => (
                <li key={a.id} className="py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13.5px] font-medium leading-snug text-ink">{a.title}</p>
                    <Pill tone={severityTone(a.severity)}>{humanize(a.severity)}</Pill>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12.5px] text-slate-500">{a.description}</p>
                  {a.customer && (
                    <Link href={`/customers/${a.customer.id}`} className="mt-1 inline-block text-[12px] font-medium text-primary hover:underline">
                      {a.customer.full_name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
