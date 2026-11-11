"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api, apiList } from "@/lib/api";
import type { TmRule } from "@/lib/types";
import { humanize, severityTone } from "@/lib/format";
import { useToast } from "@/lib/toast";
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoading,
  Pill,
  Toggle,
} from "@/components/ui";

const PARAM_LABELS: Record<string, string> = {
  threshold: "Threshold amount (AED)",
  amount: "Amount (AED)",
  min_amount: "Minimum amount (AED)",
  count: "Minimum number of transactions",
  transactions: "Minimum number of transactions",
  window_days: "Window (days)",
  days: "Window (days)",
  window_hours: "Window (hours)",
  hours: "Window (hours)",
  sum_threshold: "Combined total threshold (AED)",
  inactive_days: "Inactive period (days)",
};

export default function TmRulesPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<TmRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TmRule | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setRules(await apiList<TmRule>("/tm-rules"));
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (rule: TmRule, value: boolean) => {
    setToggling(rule.id);
    setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, is_enabled: value } : r)));
    try {
      await api(`/tm-rules/${rule.id}`, {
        method: "PUT",
        body: { is_enabled: value, params: rule.params || {} },
      });
      toast(`Rule “${rule.name}” ${value ? "enabled" : "disabled"}.`);
    } catch (err) {
      setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, is_enabled: !value } : r)));
      toast(err instanceof Error ? err.message : "Could not update the rule.", "error");
    } finally {
      setToggling(null);
    }
  };

  const openEdit = (rule: TmRule) => {
    setEditing(rule);
    const p: Record<string, string> = {};
    Object.entries(rule.params || {}).forEach(([k, v]) => (p[k] = String(v)));
    setParams(p);
  };

  const saveParams = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const numeric: Record<string, number> = {};
      Object.entries(params).forEach(([k, v]) => (numeric[k] = Number(v)));
      await api(`/tm-rules/${editing.id}`, {
        method: "PUT",
        body: { is_enabled: editing.is_enabled, params: numeric },
      });
      toast(`Thresholds updated for “${editing.name}”.`);
      setEditing(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the rule.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoading />;

  return (
    <div>
      <PageHeader
        title="Monitoring rules"
        sub="The patterns ComplyShield watches for in your transaction stream. Thresholds follow the UAE DNFBP reporting practice for precious metals and stones dealers."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {rules.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-[15px] font-semibold text-ink">{r.name}</p>
                <p className="mt-0.5 font-mono text-[11.5px] text-slate-400">{r.code}</p>
              </div>
              <Toggle checked={r.is_enabled} disabled={toggling === r.id} onChange={(v) => toggle(r, v)} />
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-slate-500">{r.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
              {r.severity && <Pill tone={severityTone(r.severity)}>{humanize(r.severity)} severity</Pill>}
              {Object.entries(r.params || {}).map(([k, v]) => (
                <span key={k} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11.5px] font-medium tabular-nums text-slate-600">
                  {PARAM_LABELS[k] || humanize(k)}: {Number(v).toLocaleString()}
                </span>
              ))}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => openEdit(r)}>
                Edit thresholds
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {rules.length === 0 && (
        <Card className="p-10 text-center text-[13px] text-slate-400">
          No monitoring rules were returned by the API.
        </Card>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit thresholds — ${editing.name}` : ""}
        sub={editing?.description || undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={saveParams}>
              {busy ? "Saving…" : "Save thresholds"}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.keys(params).length === 0 && (
              <p className="text-[13px] text-slate-500">This rule has no adjustable parameters.</p>
            )}
            {Object.entries(params).map(([k, v]) => (
              <Field key={k} label={PARAM_LABELS[k] || humanize(k)}>
                <Input
                  type="number"
                  min="0"
                  value={v}
                  onChange={(e) => setParams((p) => ({ ...p, [k]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
