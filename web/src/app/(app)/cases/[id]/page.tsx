"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { CaseItem, StrReport } from "@/lib/types";
import { canDecide, useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { caseStatusTone, fmtDate, fmtDateTime, fmtMoney, humanize, strStatusTone } from "@/lib/format";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Modal,
  PageLoading,
  Pill,
  Select,
  Textarea,
} from "@/components/ui";
import { RiskPill, ScreeningPill } from "@/components/CustomerBits";
import { IconChevronLeft, IconFileText } from "@/components/icons";

const STATUSES = [
  "open",
  "investigating",
  "pending_mlro",
  "closed_no_action",
  "str_filed",
  "customer_exited",
];

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const privileged = canDecide(user?.role);

  const [item, setItem] = useState<CaseItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);
  const [strOpen, setStrOpen] = useState(false);
  const [strBusy, setStrBusy] = useState(false);
  const [strForm, setStrForm] = useState({ report_type: "STR", reason: "", narrative: "", amount_involved: "" });

  const load = useCallback(async () => {
    try {
      const res = await api<any>(`/cases/${params.id}`);
      const c = (res?.case ?? res) as CaseItem;
      setItem(c);
      setStatus(c.status);
      setResolution(c.resolution || "");
    } catch {
      toast("Case not found or the API is unavailable.", "error");
      router.push("/cases");
    } finally {
      setLoading(false);
    }
  }, [params.id, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (item?.customer) {
      const total = (item.customer.transactions || []).reduce((s, t) => s + Number(t.amount || 0), 0);
      setStrForm((f) => ({
        ...f,
        amount_involved: f.amount_involved || (total ? String(total) : ""),
        narrative:
          f.narrative ||
          `Customer ${item.customer!.full_name} (${item.customer!.customer_no}) was onboarded on ${fmtDate(item.customer!.created_at)}. Case ${item.case_no} was opened from a ${humanize(item.source).toLowerCase()} trigger: ${item.title}. Screening status: ${humanize(item.customer!.screening_status)}; risk level ${humanize(item.customer!.risk_level)} (score ${item.customer!.risk_score ?? "—"}). The activity could not be satisfactorily explained by the customer, and the MLRO has decided to report.`,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (loading) return <PageLoading />;
  if (!item) return null;

  const customer = item.customer;
  const reports: StrReport[] = item.str_reports ?? [];

  const save = async () => {
    setSaving(true);
    try {
      await api(`/cases/${item.id}`, {
        method: "PUT",
        body: { status, resolution: resolution || null },
      });
      toast("Case updated.");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update the case.", "error");
    } finally {
      setSaving(false);
    }
  };

  const createStr = async () => {
    if (!strForm.narrative.trim()) {
      toast("The STR needs a narrative before it can be drafted.", "error");
      return;
    }
    setStrBusy(true);
    try {
      const created = await api<StrReport>(`/cases/${item.id}/str`, {
        method: "POST",
        body: {
          report_type: strForm.report_type,
          reason: strForm.reason || item.title,
          narrative: strForm.narrative,
          amount_involved: strForm.amount_involved ? Number(strForm.amount_involved) : null,
        },
      });
      toast(`Draft ${created.report_type} ${created.report_no} created with a goAML file. Review it under Reports.`);
      setStrOpen(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create the STR draft.", "error");
    } finally {
      setStrBusy(false);
    }
  };

  return (
    <div>
      <Link href="/cases" className="mb-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-slate-500 hover:text-primary">
        <IconChevronLeft className="h-4 w-4" /> Back to cases
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="font-display text-[22px] font-bold text-ink">{item.title}</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {item.case_no} · opened {fmtDateTime(item.created_at)} · source {humanize(item.source)}
            {item.due_at ? ` · due ${fmtDate(item.due_at)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={item.priority === "high" ? "red" : item.priority === "low" ? "slate" : "amber"}>
            {humanize(item.priority || "medium")} priority
          </Pill>
          <Pill tone={caseStatusTone(item.status)}>{humanize(item.status)}</Pill>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="p-5">
            <h3 className="font-display text-[15px] font-semibold text-ink">Case summary</h3>
            <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-slate-600">
              {item.description || "No description was recorded when this case was opened. Add the working notes in the resolution field as the investigation progresses."}
            </p>
            {item.resolution && (
              <>
                <h4 className="mt-5 font-display text-[13.5px] font-semibold text-ink">Resolution / working notes</h4>
                <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-slate-600">{item.resolution}</p>
              </>
            )}
            {item.closed_at && (
              <p className="mt-4 text-[12.5px] text-slate-400">Closed {fmtDateTime(item.closed_at)}</p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="STR / SAR reports from this case"
              sub="Drafts are generated with a goAML XML file attached, ready for the MLRO to file on the UAE FIU portal."
              action={
                privileged ? (
                  <Button size="sm" onClick={() => setStrOpen(true)}>
                    <IconFileText className="h-4 w-4" /> Create STR draft
                  </Button>
                ) : undefined
              }
            />
            {reports.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-slate-500">
                No report has been drafted from this case yet.
                {!privileged && " Drafting an STR is restricted to the MLRO and the account owner."}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {reports.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                    <div>
                      <p className="text-[13.5px] font-medium text-ink">
                        {r.report_type} · {r.report_no}
                      </p>
                      <p className="text-[12px] text-slate-400">
                        {fmtMoney(r.amount_involved)} involved · created {fmtDate(r.created_at)}
                        {r.filed_at ? ` · filed ${fmtDate(r.filed_at)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Pill tone={strStatusTone(r.status)}>{humanize(r.status)}</Pill>
                      <Link href="/reports" className="text-[12.5px] font-medium text-primary hover:underline">
                        Open in Reports
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-display text-[14.5px] font-semibold text-ink">Customer</h3>
            {customer ? (
              <div className="mt-3 space-y-2.5 text-[13px]">
                <Link href={`/customers/${customer.id}`} className="font-display text-[15px] font-semibold text-primary-dark hover:underline">
                  {customer.full_name}
                </Link>
                <p className="text-slate-400">{customer.customer_no}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <ScreeningPill status={customer.screening_status} />
                  <RiskPill level={customer.risk_level} score={customer.risk_score} />
                </div>
                <dl className="space-y-1.5 border-t border-line pt-3 text-[12.5px]">
                  <div className="flex justify-between"><dt className="text-slate-400">Nationality</dt><dd className="font-medium text-ink">{customer.nationality || "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">KYC</dt><dd className="font-medium text-ink">{humanize(customer.kyc_status)}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">Status</dt><dd className="font-medium text-ink">{humanize(customer.status)}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">Transactions on file</dt><dd className="font-medium tabular-nums text-ink">{(customer.transactions || []).length}</dd></div>
                </dl>
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-slate-400">Customer details are not attached to this case.</p>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-display text-[14.5px] font-semibold text-ink">Case handling</h3>
            <div className="mt-3 space-y-4">
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Resolution / working notes">
                <Textarea rows={4} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="What was established, what the customer said, and the MLRO's conclusion…" />
              </Field>
              <Button className="w-full" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save case"}
              </Button>
              <p className="text-[12px] leading-relaxed text-slate-400">
                Setting the status to “STR filed” is normally done from the report itself once the MLRO
                marks it filed.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={strOpen}
        onClose={() => setStrOpen(false)}
        title="Create STR draft"
        sub={`Case ${item.case_no} · ${customer?.full_name || ""}`}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setStrOpen(false)}>
              Cancel
            </Button>
            <Button disabled={strBusy} onClick={createStr}>
              {strBusy ? "Drafting…" : "Create draft with goAML file"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Report type">
              <Select value={strForm.report_type} onChange={(e) => setStrForm((f) => ({ ...f, report_type: e.target.value }))}>
                <option value="STR">STR — Suspicious Transaction Report</option>
                <option value="SAR">SAR — Suspicious Activity Report</option>
              </Select>
            </Field>
            <Field label="Amount involved (AED)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={strForm.amount_involved}
                onChange={(e) => setStrForm((f) => ({ ...f, amount_involved: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Reason for suspicion" required>
            <Input
              value={strForm.reason}
              onChange={(e) => setStrForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder={item.title}
            />
          </Field>
          <Field
            label="Narrative"
            hint="Pre-filled from the case and customer file. Edit it into the final wording — this text goes into the goAML report."
          >
            <Textarea rows={7} value={strForm.narrative} onChange={(e) => setStrForm((f) => ({ ...f, narrative: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
