"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, apiList } from "@/lib/api";
import type { FormField as FF } from "@/lib/types";
import { humanize } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { Button, Card, PageHeader, PageLoading, Pill, Toggle } from "@/components/ui";

export default function FormBuilderPage() {
  const { toast } = useToast();
  const [fields, setFields] = useState<FF[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await apiList<FF>("/settings/form-fields");
      setFields([...list].sort((a, b) => (a.sort || 0) - (b.sort || 0)));
    } catch {
      setFields([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => {
    const map = new Map<string, FF[]>();
    fields.forEach((f) => {
      const key = f.section || "Customer details";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    return [...map.entries()];
  }, [fields]);

  const patch = (id: number, changes: Partial<FF>) => {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...changes } : f)));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api("/settings/form-fields", {
        method: "PUT",
        body: {
          fields: fields.map((f) => ({
            id: f.id,
            field_key: f.field_key,
            label: f.label,
            section: f.section,
            is_mandatory: f.is_mandatory,
            is_enabled: f.is_enabled,
            sort: f.sort,
          })),
        },
      });
      toast("Customer form updated. The Add Customer wizard now uses this layout.");
      setDirty(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the form layout.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoading />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Customer form builder"
        sub="Decide what your team captures at onboarding. Fields you switch off disappear from the Add Customer form; mandatory fields must be completed before a customer can be saved."
        actions={
          <Button disabled={!dirty || saving} onClick={save}>
            {saving ? "Saving…" : dirty ? "Save form layout" : "Saved"}
          </Button>
        }
      />

      {fields.length === 0 ? (
        <Card className="p-10 text-center text-[13px] text-slate-400">
          No form fields were returned by the API.
        </Card>
      ) : (
        <div className="space-y-4">
          {sections.map(([section, items]) => (
            <Card key={section}>
              <div className="border-b border-line px-5 py-4">
                <h3 className="font-display text-[15px] font-semibold text-ink">{humanize(section)}</h3>
                <p className="mt-0.5 text-[12.5px] text-slate-500">
                  {items.filter((i) => i.is_enabled).length} of {items.length} fields shown ·{" "}
                  {items.filter((i) => i.is_enabled && i.is_mandatory).length} mandatory
                </p>
              </div>
              <ul className="divide-y divide-line">
                {items.map((f) => (
                  <li key={f.id} className={`flex flex-wrap items-center gap-3 px-5 py-3 ${!f.is_enabled ? "opacity-55" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-ink">{f.label}</p>
                      <p className="font-mono text-[11.5px] text-slate-400">{f.field_key}</p>
                    </div>
                    {f.is_mandatory && f.is_enabled && <Pill tone="amber" dot={false}>Mandatory</Pill>}
                    <label className="flex items-center gap-2 text-[12.5px] text-slate-500">
                      <input
                        type="checkbox"
                        checked={f.is_mandatory}
                        disabled={!f.is_enabled}
                        onChange={(e) => patch(f.id, { is_mandatory: e.target.checked })}
                        className="h-4 w-4 accent-[#0E7569]"
                      />
                      Required
                    </label>
                    <Toggle checked={f.is_enabled} onChange={(v) => patch(f.id, { is_enabled: v })} />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-slate-400">
        Name, date of birth and nationality drive screening quality — switching them off weakens your
        matches. Identification document capture is always required by the onboarding flow, regardless
        of this layout, because KYC cannot be approved without a verified document.
      </p>
    </div>
  );
}
