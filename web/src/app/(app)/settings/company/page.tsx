"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Company } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { fmtDate, humanize } from "@/lib/format";
import { Button, Card, Field, Input, PageHeader, PageLoading, Pill, Select } from "@/components/ui";

const SECTORS = [
  { value: "jewellery", label: "Jewellery & precious metals" },
  { value: "real_estate", label: "Real estate" },
  { value: "insurance", label: "Insurance" },
  { value: "audit", label: "Audit & accounting" },
  { value: "exchange", label: "Money exchange / remittance" },
  { value: "other", label: "Other designated business" },
];

export default function CompanySettingsPage() {
  const { toast } = useToast();
  const { setCompany } = useAuth();
  const [company, setLocal] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trade_license_no: "",
    sector: "jewellery",
    country: "UAE",
    city: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    api<Company>("/settings/company")
      .then((c) => {
        setLocal(c);
        setForm({
          name: c.name || "",
          trade_license_no: c.trade_license_no || "",
          sector: c.sector || "jewellery",
          country: c.country || "UAE",
          city: c.city || "",
          phone: c.phone || "",
          email: c.email || "",
        });
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    try {
      const updated = await api<Company>("/settings/company", { method: "PUT", body: form });
      setLocal(updated);
      setCompany(updated);
      toast("Company profile saved.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the company profile.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoading />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Company settings"
        sub="The subscriber business this workspace belongs to. These details appear on reports and in the goAML filing information."
      />
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal business name" required>
            <Input value={form.name} onChange={set("name")} />
          </Field>
          <Field label="Trade licence number">
            <Input value={form.trade_license_no} onChange={set("trade_license_no")} placeholder="e.g. DED-1188342" />
          </Field>
          <Field label="Sector" required>
            <Select value={form.sector} onChange={set("sector")}>
              {SECTORS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Country">
            <Input value={form.country} onChange={set("country")} />
          </Field>
          <Field label="City / Emirate">
            <Input value={form.city} onChange={set("city")} placeholder="Dubai" />
          </Field>
          <Field label="Business phone">
            <Input value={form.phone} onChange={set("phone")} placeholder="+971 …" />
          </Field>
          <Field label="Business email">
            <Input type="email" value={form.email} onChange={set("email")} placeholder="compliance@company.com" />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-page px-4 py-3.5 text-[12.5px] text-slate-500">
          <span>
            Plan:{" "}
            <span className="ml-1">
              <Pill tone="teal" dot={false}>
                {humanize(company?.plan || "starter")}
              </Pill>
            </span>
          </span>
          <span>
            Plan renews: <strong className="text-ink">{fmtDate(company?.plan_expires_at)}</strong>
          </span>
          <span>
            Screening credits used this month:{" "}
            <strong className="tabular-nums text-ink">{company?.screening_credits_used ?? 0}</strong>
          </span>
          <span>
            Workspace status: <strong className="text-ink">{humanize(company?.status || "active")}</strong>
          </span>
        </div>

        <div className="mt-5 flex justify-end">
          <Button disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save company profile"}
          </Button>
        </div>
      </Card>

      <p className="mt-4 text-[12px] leading-relaxed text-slate-400">
        Changing the sector re-tunes the default monitoring thresholds and the EWRA factor guidance for
        your line of business. Licence details should match the document issued by your economic
        department — they are printed on regulator-facing exports.
      </p>
    </div>
  );
}
