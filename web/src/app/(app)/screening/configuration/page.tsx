"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api, apiList } from "@/lib/api";
import type { Provider, UsageRow } from "@/lib/types";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { Button, Card, Field, Input, PageHeader, PageLoading, Pill, Select, Toggle } from "@/components/ui";

const LIST_CARDS: { key: string; title: string; blurb: string }[] = [
  { key: "ofac", title: "OFAC — US Treasury", blurb: "Specially Designated Nationals (SDN) and consolidated US sanctions lists." },
  { key: "eu", title: "EU Consolidated Financial Sanctions", blurb: "Persons, groups and entities under European Union financial sanctions." },
  { key: "un", title: "UN Security Council Consolidated", blurb: "The UN sanctions committees' consolidated list, including ISIL and Al-Qaida." },
  { key: "uk", title: "UK Sanctions List", blurb: "Designations under the UK Sanctions and Anti-Money Laundering Act." },
];

export default function ScreeningConfigurationPage() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  // OpenSanctions form
  const [osEnabled, setOsEnabled] = useState(false);
  const [osMode, setOsMode] = useState("realtime");
  const [osKey, setOsKey] = useState("");
  const [osThreshold, setOsThreshold] = useState(70);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ps, us] = await Promise.all([
        apiList<Provider>("/screening/providers").catch(() => []),
        api<unknown>("/settings/usage")
          .then((d) => {
            const dd = (d ?? {}) as Record<string, any>;
            return (dd.usage ?? dd.rows ?? (Array.isArray(d) ? d : [])) as UsageRow[];
          })
          .catch(() => [] as UsageRow[]),
      ]);
      setProviders(ps);
      setUsage(us);
      const os = ps.find((p) => p.provider === "opensanctions");
      if (os) {
        setOsEnabled(os.is_enabled);
        setOsMode(os.mode || "realtime");
        const t = Number(os.threshold ?? 0.7);
        setOsThreshold(t <= 1 ? Math.round(t * 100) : Math.round(t));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const os = providers.find((p) => p.provider === "opensanctions");
  const findList = (key: string) => providers.find((p) => p.provider === key);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const osUsage = usage.filter((u) => u.provider === "opensanctions");
  const monthCalls = osUsage
    .filter((u) => u.month === thisMonth)
    .reduce((s, u) => s + Number(u.calls || 0), 0);
  const monthCredits = osUsage
    .filter((u) => u.month === thisMonth)
    .reduce((s, u) => s + Number(u.credits || 0), 0);
  const allCredits = osUsage.reduce((s, u) => s + Number(u.credits || 0), 0);

  const saveOpenSanctions = async () => {
    setSaving(true);
    try {
      await api("/screening/providers/opensanctions", {
        method: "PUT",
        body: {
          is_enabled: osEnabled,
          mode: osMode,
          threshold: osThreshold / 100,
          ...(osKey.trim() ? { api_key: osKey.trim() } : {}),
        },
      });
      toast("OpenSanctions settings saved.");
      setOsKey("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save provider settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoading />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Screening configuration"
        sub="Where your screening data comes from, and how strictly names are matched. The official lists are loaded locally and refreshed nightly; OpenSanctions adds live PEP and worldwide coverage."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-5 py-3.5">
        <Pill tone="green">Engine ready</Pill>
        <Pill tone="green">Worker online</Pill>
        <span className="text-[12.5px] text-slate-500">
          Screening is available: every enabled watchlist is loaded and up to date. Lists sync nightly
          at 01:30 GST.
        </span>
      </div>

      {/* OpenSanctions card */}
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <div className="flex items-center gap-2.5">
              <h3 className="font-display text-[16px] font-semibold text-ink">OpenSanctions</h3>
              <Pill tone={os?.is_enabled ? "green" : "slate"}>{os?.is_enabled ? "On" : "Off"}</Pill>
              {os?.has_key ? (
                <Pill tone="teal" dot={false}>
                  API key stored{os.key_stored_at ? ` ${fmtDate(os.key_stored_at)}` : ""}
                  {os.api_key_masked || os.masked_key || os.key_last4 ? ` · ••••${os.api_key_masked || os.masked_key || os.key_last4}` : ""}
                </Pill>
              ) : (
                <Pill tone="amber" dot={false}>
                  No API key — local fallback active
                </Pill>
              )}
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
              Aggregates 470+ official datasets — sanctions, PEPs, wanted and exclusion lists —
              covering 1.7 million people and companies. This is the source of your PEP data and of
              lists beyond the four core sanctions lists.
            </p>
          </div>
          <Toggle checked={osEnabled} onChange={setOsEnabled} />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line p-4">
            <p className="text-[13px] font-semibold text-ink">How names are checked</p>
            <div className="mt-3 space-y-2">
              <label className={`flex cursor-pointer gap-3 rounded-lg border px-3.5 py-3 transition ${osMode === "realtime" ? "border-primary bg-primary-soft/50" : "border-line"}`}>
                <input type="radio" name="os-mode" checked={osMode === "realtime"} onChange={() => setOsMode("realtime")} className="mt-0.5 accent-[#0E7569]" />
                <span>
                  <span className="block text-[13px] font-medium text-ink">Check in real time (API)</span>
                  <span className="block text-[12px] leading-relaxed text-slate-500">
                    Each check asks OpenSanctions, so data is always current. The name being screened
                    is sent to OpenSanctions — use only where your data-protection rules allow it.
                  </span>
                </span>
              </label>
              <label className={`flex cursor-pointer gap-3 rounded-lg border px-3.5 py-3 transition ${osMode === "file" ? "border-primary bg-primary-soft/50" : "border-line"}`}>
                <input type="radio" name="os-mode" checked={osMode === "file"} onChange={() => setOsMode("file")} className="mt-0.5 accent-[#0E7569]" />
                <span>
                  <span className="block text-[13px] font-medium text-ink">Check in a downloaded file</span>
                  <span className="block text-[12px] leading-relaxed text-slate-500">
                    The list is downloaded to your own system and names never leave it. Works even if
                    OpenSanctions is down; refreshing runs on the schedule you set.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <Field
              label="API key"
              hint={
                os?.has_key
                  ? "A key is already stored. Enter a new one only to replace it; it is write-only and never shown."
                  : "Get a key from opensanctions.org. Without one, screening falls back to the local lists."
              }
            >
              <Input
                type="password"
                value={osKey}
                onChange={(e) => setOsKey(e.target.value)}
                placeholder={os?.has_key ? "•••••••••••• (stored)" : "Paste your OpenSanctions API key"}
                autoComplete="off"
              />
            </Field>
            <Field label="Match threshold (%)" hint="Names scoring at or above this are raised as candidates. 70% is the recommended balance.">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={osThreshold}
                  onChange={(e) => setOsThreshold(Number(e.target.value))}
                  className="flex-1 accent-[#0E7569]"
                />
                <span className="w-12 text-right font-display text-[15px] font-bold tabular-nums text-ink">{osThreshold}%</span>
              </div>
            </Field>
            <Field label="Matching logic">
              <Select value="v2" onChange={() => undefined}>
                <option value="v2">Logic v2 — name, DOB and nationality aware</option>
              </Select>
            </Field>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-[12.5px] text-slate-500">
            Usage this month: <strong className="tabular-nums text-ink">{monthCalls} calls · {monthCredits} credits</strong>
            {" "}· all time {allCredits} credits. OpenSanctions' own invoice decides the final figures;
            names searched are never stored by the provider.
          </p>
          <Button disabled={saving} onClick={saveOpenSanctions}>
            {saving ? "Saving…" : "Save OpenSanctions settings"}
          </Button>
        </div>
      </Card>

      {/* Official loaded lists */}
      <div className="grid gap-4 md:grid-cols-2">
        {LIST_CARDS.map((card) => {
          const p = findList(card.key);
          return (
            <Card key={card.key} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-[15px] font-semibold text-ink">{card.title}</h3>
                <Pill tone={p ? "green" : "slate"}>{p ? "Loaded" : "Not loaded"}</Pill>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">{card.blurb}</p>
              <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3.5 text-[12.5px]">
                <div>
                  <dt className="text-slate-400">Dataset</dt>
                  <dd className="font-medium tabular-nums text-ink">
                    {p?.entries_count
                      ? `${p.entries_count.toLocaleString()} entities`
                      : p?.dataset_size || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Mode</dt>
                  <dd className="font-medium text-ink">Loaded locally · checked in-file</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Refresh</dt>
                  <dd className="font-medium text-ink">{p?.sync_schedule || "Nightly, 01:30 GST"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Last sync</dt>
                  <dd className="font-medium text-ink">{p?.last_sync_at ? fmtDateTime(p.last_sync_at) : "With tonight's run"}</dd>
                </div>
              </dl>
              {p?.status_text && <p className="mt-2 text-[12px] text-slate-400">{p.status_text}</p>}
            </Card>
          );
        })}

        {/* Dow Jones */}
        <Card className="border-dashed p-5 opacity-90">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[15px] font-semibold text-ink">Dow Jones Risk &amp; Compliance</h3>
            <Pill tone="slate">Off</Pill>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
            The deepest commercial dataset — around 4 million entities and 11.5 million names,
            including researcher-built adverse media and special-interest persons. Available when your
            business holds its own Dow Jones subscription; ComplyShield connects to your PFA2 feed with
            the credentials Dow Jones issues you.
          </p>
          <div className="mt-4 border-t border-line pt-3.5">
            <Pill tone="amber" dot={false}>
              Requires your own subscription — not included in any ComplyShield plan
            </Pill>
            <p className="mt-2.5 text-[12px] leading-relaxed text-slate-400">
              The same applies to LSEG World-Check. If you take a subscription, contact support and the
              feed will be enabled on your workspace with your own credentials.
            </p>
          </div>
        </Card>

        <Card className="bg-primary-soft/50 p-5">
          <h3 className="font-display text-[15px] font-semibold text-ink">About the nightly sync</h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
            The UAE framework allows designated businesses up to 24 hours to apply list changes, and
            the nightly schedule keeps you inside that window. If a name is added to a freeze list
            during the day, the scheduler can be run more frequently from this workspace during
            sensitive periods — raise a case with support and it will be adjusted for you.
          </p>
        </Card>
      </div>
    </div>
  );
}
