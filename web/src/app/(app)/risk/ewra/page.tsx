"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api, apiList } from "@/lib/api";
import type { Ewra } from "@/lib/types";
import { fmtDate, humanize } from "@/lib/format";
import { canDecide, useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoading,
  Pill,
  Textarea,
} from "@/components/ui";
import { IconPlus } from "@/components/icons";

const FACTORS = [
  { key: "customer_score", label: "Customer risk", hint: "Who your customers are: PEPs, cash-intensive trades, complex structures." },
  { key: "products_score", label: "Products & services", hint: "What you sell: high-value portable goods such as gold carry more risk." },
  { key: "channels_score", label: "Delivery channels", hint: "How business arrives: walk-ins and intermediaries vs. account customers." },
  { key: "geography_score", label: "Geography & jurisdiction", hint: "Countries you and your customers deal with, including high-risk corridors." },
  { key: "counterparty_score", label: "Counterparties", hint: "Suppliers, refiners, dealers and agents you transact through." },
] as const;

type FactorKey = (typeof FACTORS)[number]["key"];

function scoreOf(e: Ewra, key: FactorKey): number {
  const alt = key.replace("_score", "") as keyof Ewra;
  return Number(e[key] ?? e[alt] ?? 0);
}

function inherentOf(e: Ewra): number {
  if (e.inherent_score) return Number(e.inherent_score);
  const vals = FACTORS.map((f) => scoreOf(e, f.key));
  return Math.round((vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length)) * 10) / 10;
}

function residualOf(e: Ewra): number | null {
  const r = e.residual_score ?? e.residual;
  return r === null || r === undefined ? null : Number(r);
}

function band(score: number): { label: string; tone: "green" | "amber" | "red" } {
  if (score < 30) return { label: "Low", tone: "green" };
  if (score < 60) return { label: "Medium", tone: "amber" };
  return { label: "High", tone: "red" };
}

export default function EwraPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const privileged = canDecide(user?.role);
  const [rows, setRows] = useState<Ewra[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ewra | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    period: "2026",
    methodology_note: "",
    scores: { customer_score: 40, products_score: 55, channels_score: 35, geography_score: 30, counterparty_score: 25 } as Record<FactorKey, number>,
  });

  const load = useCallback(async () => {
    try {
      setRows(await apiList<Ewra>("/risk/ewra"));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({
      title: `EWRA ${new Date().getFullYear()} — annual assessment`,
      period: String(new Date().getFullYear()),
      methodology_note: "",
      scores: { customer_score: 40, products_score: 55, channels_score: 35, geography_score: 30, counterparty_score: 25 },
    });
    setModalOpen(true);
  };

  const openEdit = (e: Ewra) => {
    setEditing(e);
    const scores = {} as Record<FactorKey, number>;
    FACTORS.forEach((f) => (scores[f.key] = scoreOf(e, f.key)));
    setForm({ title: e.title, period: e.period || "", methodology_note: e.methodology_note || "", scores });
    setModalOpen(true);
  };

  const inherentPreview =
    Math.round(
      (FACTORS.reduce((s, f) => s + (form.scores[f.key] || 0), 0) / FACTORS.length) * 10
    ) / 10;

  const submit = async () => {
    if (!form.title.trim()) {
      toast("Give the assessment a title.", "error");
      return;
    }
    setBusy(true);
    try {
      const body = {
        title: form.title,
        period: form.period || null,
        methodology_note: form.methodology_note || null,
        ...form.scores,
      };
      if (editing) {
        await api(`/risk/ewra/${editing.id}`, { method: "PUT", body });
        toast("Assessment updated.");
      } else {
        await api("/risk/ewra", { method: "POST", body });
        toast("Assessment created as a draft. It takes effect once approved.");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the assessment.", "error");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (e: Ewra, status: string) => {
    try {
      await api(`/risk/ewra/${e.id}`, { method: "PUT", body: { status } });
      toast(status === "approved" ? "Assessment approved and now in force." : `Assessment moved to ${humanize(status).toLowerCase()}.`);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not change the status.", "error");
    }
  };

  if (loading) return <PageLoading />;

  return (
    <div>
      <PageHeader
        title="Enterprise-wide risk assessment"
        sub="The EWRA is the annual exercise the UAE framework expects from every designated business: score the risk you face, record the controls, and land on a residual risk the board signs off."
        actions={
          <Button onClick={openNew}>
            <IconPlus className="h-4 w-4" /> New assessment
          </Button>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No risk assessment yet"
            text="Start the first EWRA by scoring the five risk factors. One versioned methodology, reviewed and approved here — not a spreadsheet that drifts."
            action={
              <Button size="sm" onClick={openNew}>
                Start the EWRA
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((e) => {
            const inherent = inherentOf(e);
            const residual = residualOf(e);
            const ib = band(inherent);
            const rb = residual !== null ? band(residual) : null;
            return (
              <Card key={e.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-[16px] font-semibold text-ink">{e.title}</h3>
                    <p className="mt-0.5 text-[12.5px] text-slate-400">
                      Period {e.period || "—"} · created {fmtDate(e.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={e.status === "approved" ? "green" : e.status === "in_review" ? "amber" : "slate"}>
                      {humanize(e.status)}
                    </Pill>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                      Edit scores
                    </Button>
                    {e.status === "draft" && (
                      <Button variant="outline" size="sm" onClick={() => setStatus(e, "in_review")}>
                        Send for review
                      </Button>
                    )}
                    {e.status === "in_review" && privileged && (
                      <Button size="sm" onClick={() => setStatus(e, "approved")}>
                        Approve
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {FACTORS.map((f) => {
                    const v = scoreOf(e, f.key);
                    const b = band(v);
                    return (
                      <div key={f.key} className="rounded-xl border border-line p-3.5">
                        <p className="text-[11.5px] font-medium uppercase tracking-wide text-slate-400">{f.label}</p>
                        <p className="mt-1.5 font-display text-[22px] font-bold tabular-nums text-ink">
                          {v}
                          <span className="ml-1.5 align-middle">
                            <Pill tone={b.tone}>{b.label}</Pill>
                          </span>
                        </p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${b.tone === "green" ? "bg-ok" : b.tone === "amber" ? "bg-warn" : "bg-danger"}`}
                            style={{ width: `${v}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-3.5 text-[13px]">
                  <span className="text-slate-500">
                    Inherent risk: <strong className="tabular-nums text-ink">{inherent}</strong>{" "}
                    <Pill tone={ib.tone}>{ib.label}</Pill>
                  </span>
                  <span className="text-slate-500">
                    Residual risk after controls:{" "}
                    {residual !== null ? (
                      <>
                        <strong className="tabular-nums text-ink">{residual}</strong>{" "}
                        {rb && <Pill tone={rb.tone}>{rb.label}</Pill>}
                      </>
                    ) : (
                      <span className="text-slate-400">computed on approval</span>
                    )}
                  </span>
                  {e.methodology_note && (
                    <span className="w-full text-[12.5px] leading-relaxed text-slate-400">{e.methodology_note}</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit assessment" : "New enterprise risk assessment"}
        sub="Score each factor 0–100 for inherent risk, before controls."
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={submit}>
              {busy ? "Saving…" : editing ? "Save assessment" : "Create draft"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" required>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </Field>
            <Field label="Period">
              <Input value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} placeholder="2026" />
            </Field>
          </div>
          {FACTORS.map((f) => (
            <div key={f.key} className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">{f.label}</p>
                  <p className="mt-0.5 text-[12px] text-slate-400">{f.hint}</p>
                </div>
                <span className="font-display text-[20px] font-bold tabular-nums text-ink">{form.scores[f.key]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={form.scores[f.key]}
                onChange={(e) =>
                  setForm((fm) => ({ ...fm, scores: { ...fm.scores, [f.key]: Number(e.target.value) } }))
                }
                className="mt-3 w-full accent-[#0E7569]"
              />
            </div>
          ))}
          <div className="rounded-lg bg-page px-3.5 py-3 text-[13px] text-slate-600">
            Average inherent risk across the five factors:{" "}
            <strong className="tabular-nums text-ink">{inherentPreview}</strong> — residual risk is derived
            from this once the controls assessment is applied on approval.
          </div>
          <Field label="Methodology note">
            <Textarea
              rows={3}
              value={form.methodology_note}
              onChange={(e) => setForm((f) => ({ ...f, methodology_note: e.target.value }))}
              placeholder="How the scores were reached, data used, and who took part…"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
