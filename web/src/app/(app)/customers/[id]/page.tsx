"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type {
  Candidate,
  CaseItem,
  Customer,
  CustomerDocument,
  Screening,
} from "@/lib/types";
import { canDecide, useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import {
  alertStatusTone,
  caseStatusTone,
  daysUntil,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  humanize,
  isOverdue,
} from "@/lib/format";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  PageLoading,
  Pill,
  Select,
  TableWrap,
  Textarea,
  tdCls,
  thCls,
} from "@/components/ui";
import {
  CHECKLIST_ITEMS,
  DOC_TYPES,
  KycPill,
  NATIONALITIES,
  RiskPill,
  ScreeningPill,
  customerAlerts,
} from "@/components/CustomerBits";
import { ScreeningAlertDecisionModal } from "@/components/DecisionModals";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { IconAlert, IconCheck, IconChevronLeft, IconPlus, IconRefresh, IconX } from "@/components/icons";

/* ---------------- journey ---------------- */
interface Step {
  label: string;
  state: "done" | "current" | "blocked" | "pending" | "na";
  detail?: string;
}

function mapState(s?: string): Step["state"] {
  switch ((s || "").toLowerCase()) {
    case "done":
    case "completed":
    case "complete":
    case "approved":
      return "done";
    case "blocked":
    case "failed":
      return "blocked";
    case "current":
    case "in_progress":
    case "active":
    case "pending":
      return "current";
    case "not_required":
    case "na":
      return "na";
    default:
      return "pending";
  }
}

function computeJourney(c: Customer): Step[] {
  const docs = c.documents ?? [];
  const alerts = customerAlerts(c);
  const openAlerts = alerts.filter((a) => ["open", "under_review"].includes(a.status));
  const allDocsVerified = docs.length > 0 && docs.every((d) => d.verified);
  const screened = c.screening_status !== "not_screened";

  if (Array.isArray(c.journey) && c.journey.length >= 4) {
    return c.journey.map((j) => ({
      label: j.label || j.name || j.title || "Step",
      state: mapState(j.status || j.state),
      detail: j.detail || j.note || undefined,
    }));
  }

  return [
    { label: "Registration", state: "done", detail: fmtDate(c.created_at) },
    {
      label: "Document verification",
      state: docs.length === 0 ? "blocked" : allDocsVerified ? "done" : "blocked",
      detail:
        docs.length === 0
          ? "No document on file"
          : allDocsVerified
            ? "All documents verified"
            : "Verification outstanding",
    },
    {
      label: "Name screening",
      state: screened ? "done" : "current",
      detail: humanize(c.screening_status),
    },
    {
      label: "Alert clearance",
      state: !screened ? "pending" : openAlerts.length > 0 ? "blocked" : "done",
      detail:
        openAlerts.length > 0
          ? `${openAlerts.length} alert${openAlerts.length === 1 ? "" : "s"} open (e.g. #${openAlerts[0].id})`
          : screened
            ? "No open alerts"
            : undefined,
    },
    {
      label: "Risk assessment",
      state: c.risk_score !== null && c.risk_score !== undefined ? "done" : "pending",
      detail: c.risk_score != null ? `Score ${c.risk_score} · ${humanize(c.risk_level)}` : undefined,
    },
    {
      label: "EDD",
      state: !c.edd_required ? "na" : c.edd_status === "completed" ? "done" : "current",
      detail: !c.edd_required ? "Not required" : humanize(c.edd_status),
    },
    {
      label: "KYC approval",
      state:
        c.kyc_status === "approved"
          ? "done"
          : c.kyc_status === "rejected"
            ? "blocked"
            : openAlerts.length > 0 || !allDocsVerified
              ? "blocked"
              : "current",
      detail: humanize(c.kyc_status),
    },
    {
      label: "Activation",
      state: c.status === "active" ? "done" : "pending",
      detail: humanize(c.status),
    },
    {
      label: "Ongoing monitoring",
      state: c.status === "active" ? "current" : "pending",
      detail: c.status === "active" ? "Nightly re-screening active" : "Starts on activation",
    },
  ];
}

const stepDot: Record<Step["state"], string> = {
  done: "bg-primary text-white",
  current: "bg-warn text-white",
  blocked: "bg-danger text-white",
  pending: "bg-slate-200 text-slate-400",
  na: "bg-slate-100 text-slate-400",
};

/* ---------------- page ---------------- */
const TABS = [
  "Overview",
  "Profile",
  "Documents",
  "Name Screening",
  "Alerts",
  "Transactions",
  "Risk",
  "Cases",
] as const;

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const privileged = canDecide(user?.role);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [screeningBusy, setScreeningBusy] = useState(false);
  const [decideAlert, setDecideAlert] = useState<Customer["alerts"] extends (infer A)[] | undefined ? A | null : null>(null);
  const [kycModal, setKycModal] = useState<"approve" | "reject" | null>(null);
  const [kycNotes, setKycNotes] = useState("");
  const [kycBusy, setKycBusy] = useState(false);
  const [verifyDoc, setVerifyDoc] = useState<CustomerDocument | null>(null);
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [addTxnOpen, setAddTxnOpen] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  const [selectedScreening, setSelectedScreening] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<any>(`/customers/${params.id}`);
      const c = (res?.customer ?? res) as Customer;
      if (res?.journey) (c as any).journey = res.journey;
      if (res?.attention) (c as any).attention = res.attention;
      setCustomer(c);
      if (c.screenings && c.screenings.length > 0) {
        setSelectedScreening((prev) => prev ?? c.screenings![0].id);
      }
    } catch {
      toast("Customer not found or the API is unavailable.", "error");
      router.push("/customers");
    } finally {
      setLoading(false);
    }
  }, [params.id, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const attention = useMemo(() => {
    if (!customer) return [] as { text: string; tone: "red" | "amber" }[];
    const items: { text: string; tone: "red" | "amber" }[] = [];
    const docs = customer.documents ?? [];
    const alerts = customerAlerts(customer);
    const open = alerts.filter((a) => ["open", "under_review"].includes(a.status));
    const overdue = open.filter((a) => isOverdue(a.due_at, a.status));
    if (docs.length === 0)
      items.push({ text: "No identity document on file. The customer cannot be KYC-approved until a document is recorded and verified.", tone: "red" });
    else if (!docs.every((d) => d.verified))
      items.push({ text: "Identity document verification is outstanding. Complete the checklist on the Documents tab.", tone: "amber" });
    docs.forEach((d) => {
      const days = daysUntil(d.expiry_date);
      if (days !== null && days < 0)
        items.push({ text: `${humanize(d.doc_type)} ${d.doc_number || ""} expired on ${fmtDate(d.expiry_date)}. Request a renewed document.`, tone: "red" });
      else if (days !== null && days <= 60)
        items.push({ text: `${humanize(d.doc_type)} expires in ${days} days (${fmtDate(d.expiry_date)}).`, tone: "amber" });
    });
    if (open.length > 0)
      items.push({
        text: `${open.length} screening alert${open.length === 1 ? " is" : "s are"} open${overdue.length ? `, ${overdue.length} overdue` : ""}. KYC approval is blocked until ${open.length === 1 ? "it is" : "they are"} decided.`,
        tone: overdue.length ? "red" : "amber",
      });
    if (customer.edd_required && customer.edd_status !== "completed")
      items.push({ text: "Enhanced due diligence (EDD) is required for this customer and has not been completed.", tone: "amber" });
    if (customer.screening_status === "confirmed_match")
      items.push({ text: "Confirmed sanctions/watchlist match. The customer is restricted; consider an STR and exit.", tone: "red" });
    if (customer.kyc_status === "pending" && items.length === 0)
      items.push({ text: "File is complete and waiting for KYC approval by the MLRO or owner.", tone: "amber" });
    return items;
  }, [customer]);

  if (loading) return <PageLoading />;
  if (!customer) return null;

  const docs = customer.documents ?? [];
  const alerts = customerAlerts(customer);
  const openAlerts = alerts.filter((a) => ["open", "under_review"].includes(a.status));
  const screenings = customer.screenings ?? [];
  const activeScreening =
    screenings.find((s) => s.id === selectedScreening) ?? screenings[0] ?? null;
  const journey = computeJourney(customer);

  const runScreening = async () => {
    setScreeningBusy(true);
    try {
      const sRes = await api<any>(`/customers/${customer.id}/screen`, { method: "POST" });
      const s = (sRes?.screening ?? sRes) as Screening;
      toast(
        s.status === "clear"
          ? "Re-screening complete: no match at or above the threshold."
          : `Re-screening complete: ${humanize(s.status).toLowerCase()} with a best score of ${s.best_score ?? 0}%.`,
        s.status === "clear" ? "success" : "info"
      );
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Re-screening failed.", "error");
    } finally {
      setScreeningBusy(false);
    }
  };

  const submitKyc = async () => {
    if (!kycModal) return;
    setKycBusy(true);
    try {
      await api(`/customers/${customer.id}/kyc`, {
        method: "POST",
        body: { decision: kycModal, notes: kycNotes || undefined },
      });
      toast(kycModal === "approve" ? "KYC approved. The customer can now be activated." : "KYC rejected and the customer file closed to trading.", kycModal === "approve" ? "success" : "info");
      setKycModal(null);
      setKycNotes("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not record the KYC decision.", "error");
    } finally {
      setKycBusy(false);
    }
  };

  return (
    <div>
      <Link href="/customers" className="mb-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-slate-500 hover:text-primary">
        <IconChevronLeft className="h-4 w-4" /> Back to customers
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold text-ink">
            {customer.full_name}
            {customer.name_ar && <span className="ml-2 text-[16px] font-medium text-slate-400">{customer.name_ar}</span>}
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {customer.customer_no} · {humanize(customer.type)} · {humanize(customer.member_category)} ·{" "}
            {humanize(customer.residency)} · onboarded {fmtDate(customer.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={runScreening} disabled={screeningBusy}>
            <IconRefresh className="h-4 w-4" /> {screeningBusy ? "Screening…" : "Re-screen now"}
          </Button>
          {privileged && customer.kyc_status === "pending" && (
            <>
              <Button variant="danger" onClick={() => setKycModal("reject")}>
                Reject KYC
              </Button>
              <Button onClick={() => setKycModal("approve")}>Approve KYC</Button>
            </>
          )}
        </div>
      </div>

      {/* Status cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "KYC", value: <KycPill status={customer.kyc_status} />, sub: customer.kyc_status === "pending" ? "Awaiting MLRO decision" : `Status: ${humanize(customer.kyc_status)}` },
          { label: "Screening", value: <ScreeningPill status={customer.screening_status} />, sub: screenings.length ? `Last run ${fmtDate(screenings[0]?.created_at)}` : "Not run yet" },
          { label: "Risk level", value: <RiskPill level={customer.risk_level} score={customer.risk_score} />, sub: customer.risk_score != null ? `Score ${customer.risk_score} / 100` : "Not scored" },
          { label: "EDD", value: <Pill tone={customer.edd_required ? (customer.edd_status === "completed" ? "green" : "amber") : "slate"}>{customer.edd_required ? humanize(customer.edd_status || "pending") : "Not required"}</Pill>, sub: customer.next_review_date ? `Next review ${fmtDate(customer.next_review_date)}` : "No review scheduled" },
          { label: "Account status", value: <Pill tone={customer.status === "active" ? "green" : customer.status === "restricted" ? "red" : "amber"}>{humanize(customer.status)}</Pill>, sub: `${openAlerts.length} open alert${openAlerts.length === 1 ? "" : "s"}` },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <p className="text-[11.5px] font-medium uppercase tracking-wide text-slate-400">{c.label}</p>
            <div className="mt-2">{c.value}</div>
            <p className="mt-1.5 text-[12px] text-slate-500">{c.sub}</p>
          </Card>
        ))}
      </div>

      {/* What needs attention */}
      {attention.length > 0 && (
        <div className="mt-4 rounded-xl border border-warn/30 bg-warn-soft px-5 py-4">
          <p className="flex items-center gap-2 font-display text-[14px] font-semibold text-ink">
            <IconAlert className="h-4.5 w-4.5 text-warn" /> What needs attention
          </p>
          <ul className="mt-2 space-y-1.5">
            {attention.map((a, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-slate-700">
                <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${a.tone === "red" ? "bg-danger" : "bg-warn"}`} />
                {a.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div className="scroll-thin mt-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition ${
              tab === t ? "border-primary text-primary-dark" : "border-transparent text-slate-500 hover:text-ink"
            }`}
          >
            {t}
            {t === "Alerts" && openAlerts.length > 0 && (
              <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-[10.5px] font-semibold text-white">
                {openAlerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "Overview" && (
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Compliance journey" sub="Where this customer sits in the onboarding pipeline" />
              <ol className="px-5 py-4">
                {journey.map((s, i) => (
                  <li key={i} className="relative flex gap-3.5 pb-5 last:pb-1">
                    {i < journey.length - 1 && (
                      <span className="absolute left-[13px] top-7 h-[calc(100%-24px)] w-px bg-line" />
                    )}
                    <span className={`z-10 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full ${stepDot[s.state]}`}>
                      {s.state === "done" ? (
                        <IconCheck className="h-3.5 w-3.5" />
                      ) : s.state === "blocked" ? (
                        <IconX className="h-3.5 w-3.5" />
                      ) : (
                        <span className="text-[11px] font-semibold">{i + 1}</span>
                      )}
                    </span>
                    <div className="pt-0.5">
                      <p className={`text-[13.5px] font-medium ${s.state === "blocked" ? "text-danger" : "text-ink"}`}>
                        {s.label}
                        {s.state === "na" && <span className="ml-2 text-[11.5px] font-normal text-slate-400">not required</span>}
                      </p>
                      {s.detail && <p className="text-[12px] text-slate-400">{s.detail}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader title="Key facts" />
                <dl className="space-y-2.5 px-5 py-4 text-[13px]">
                  {[
                    ["Nationality", customer.nationality],
                    ["Date of birth", fmtDate(customer.dob)],
                    ["Occupation", customer.occupation],
                    ["Employer", customer.employer],
                    ["Source of funds", customer.source_of_funds],
                    ["Expected activity", customer.expected_activity],
                    ["Phone", customer.phone],
                    ["Email", customer.email],
                    ["Address", [customer.address_line, customer.city, customer.country].filter(Boolean).join(", ")],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3">
                      <dt className="w-32 shrink-0 text-slate-400">{k}</dt>
                      <dd className="font-medium text-ink">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <Card>
                <CardHeader title="Latest screening" sub={activeScreening ? fmtDateTime(activeScreening.created_at) : undefined} />
                <div className="px-5 py-4">
                  {activeScreening ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Pill tone={activeScreening.status === "clear" ? "green" : activeScreening.status === "confirmed" ? "red" : "amber"}>
                          {humanize(activeScreening.status)}
                        </Pill>
                        <span className="text-[12.5px] text-slate-500">
                          Best score {activeScreening.best_score ?? 0}% · {activeScreening.candidates_count ?? 0} candidates ·{" "}
                          {humanize(activeScreening.mode)} engine
                        </span>
                      </div>
                      <button onClick={() => setTab("Name Screening")} className="mt-3 text-[12.5px] font-medium text-primary hover:underline">
                        View candidates and full history
                      </button>
                    </>
                  ) : (
                    <p className="text-[13px] text-slate-500">No screening has been run for this customer yet.</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "Profile" && <ProfileTab customer={customer} onSaved={load} />}

        {tab === "Documents" && (
          <Card>
            <CardHeader
              title="Identity documents"
              sub="A customer needs at least one verified identity document before KYC approval."
              action={
                <Button size="sm" onClick={() => setAddDocOpen(true)}>
                  <IconPlus className="h-4 w-4" /> Add document
                </Button>
              }
            />
            {docs.length === 0 ? (
              <EmptyState
                title="No documents recorded"
                text="Add the customer's Emirates ID, passport or other accepted identity document to start verification."
                action={
                  <Button size="sm" onClick={() => setAddDocOpen(true)}>
                    Add the first document
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 p-5 md:grid-cols-2">
                {docs.map((d) => {
                  const days = daysUntil(d.expiry_date);
                  const checklist = d.verification || {};
                  const doneCount = CHECKLIST_ITEMS.filter((i) => checklist[i.key] === "verified").length;
                  return (
                    <div key={d.id} className="rounded-xl border border-line p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-display text-[14px] font-semibold text-ink">{humanize(d.doc_type)}</p>
                          <p className="mt-0.5 font-mono text-[12.5px] text-slate-500">{d.doc_number || "No number recorded"}</p>
                        </div>
                        <Pill tone={d.verified ? "green" : "amber"}>{d.verified ? "Verified" : "Pending verification"}</Pill>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
                        <div><dt className="text-slate-400">Issued</dt><dd className="font-medium text-ink">{fmtDate(d.issue_date)}</dd></div>
                        <div>
                          <dt className="text-slate-400">Expires</dt>
                          <dd className={`font-medium ${days !== null && days < 0 ? "text-danger" : days !== null && days <= 60 ? "text-warn" : "text-ink"}`}>
                            {fmtDate(d.expiry_date)}
                            {days !== null && (days < 0 ? " · expired" : ` · ${days} days left`)}
                          </dd>
                        </div>
                        <div><dt className="text-slate-400">Issuing country</dt><dd className="font-medium text-ink">{d.issuing_country || "—"}</dd></div>
                        <div><dt className="text-slate-400">File</dt><dd className="truncate font-medium text-ink">{d.file_name || "—"}</dd></div>
                      </dl>
                      <div className="mt-3 border-t border-line pt-3">
                        <p className="text-[12px] text-slate-500">
                          Checklist: {doneCount} of {CHECKLIST_ITEMS.length} items verified
                          {d.verified_at ? ` · verified ${fmtDate(d.verified_at)}` : ""}
                        </p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => setVerifyDoc(d)}>
                          Open verification checklist
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {tab === "Name Screening" && (
          <Card>
            <CardHeader
              title="Name screening history"
              sub="Every check against the sanctions, PEP and watchlist data, newest first."
              action={
                <Button size="sm" onClick={runScreening} disabled={screeningBusy}>
                  <IconRefresh className="h-4 w-4" /> {screeningBusy ? "Screening…" : "Re-screen now"}
                </Button>
              }
            />
            {screenings.length === 0 ? (
              <EmptyState title="No screenings yet" text="Run a screening to check this name against the loaded lists." />
            ) : (
              <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
                <ul className="divide-y divide-line border-b border-line lg:border-b-0 lg:border-r">
                  {screenings.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => setSelectedScreening(s.id)}
                        className={`block w-full px-4 py-3 text-left transition ${activeScreening?.id === s.id ? "bg-primary-soft/60" : "hover:bg-slate-50"}`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="text-[13px] font-medium text-ink">{fmtDateTime(s.created_at)}</span>
                          <Pill tone={s.status === "clear" ? "green" : s.status === "confirmed" ? "red" : "amber"}>{humanize(s.status)}</Pill>
                        </span>
                        <span className="mt-1 block text-[12px] text-slate-400">
                          {humanize(s.source)} · {humanize(s.mode)} · best {s.best_score ?? 0}% · {s.candidates_count ?? 0} candidates
                          {s.duration_ms ? ` · ${s.duration_ms} ms` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div>
                  {activeScreening ? (
                    <CandidateTable screening={activeScreening} />
                  ) : (
                    <p className="p-5 text-[13px] text-slate-400">Select a screening run.</p>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {tab === "Alerts" && (
          <Card>
            <CardHeader title="Screening alerts" sub="Matches raised for this customer and the decisions taken on them." />
            {alerts.length === 0 ? (
              <EmptyState title="No alerts for this customer" text="Alerts appear here when a screening finds a name at or above the match threshold." />
            ) : (
              <TableWrap>
                <table className="w-full min-w-[760px]">
                  <thead className="border-b border-line bg-slate-50/70">
                    <tr>
                      <th className={thCls}>Matched name</th>
                      <th className={thCls}>List</th>
                      <th className={thCls}>Score</th>
                      <th className={thCls}>Priority</th>
                      <th className={thCls}>Status</th>
                      <th className={thCls}>Due</th>
                      <th className={thCls}>Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {alerts.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className={`${tdCls} font-medium text-ink`}>{a.matched_name}</td>
                        <td className={tdCls}>{a.list_name}</td>
                        <td className={`${tdCls} tabular-nums`}>{a.match_score}%</td>
                        <td className={tdCls}>
                          <Pill tone={a.priority === "high" ? "red" : a.priority === "review" ? "amber" : "slate"}>{humanize(a.priority)}</Pill>
                        </td>
                        <td className={tdCls}>
                          <Pill tone={alertStatusTone(a.status)}>{humanize(a.status)}</Pill>
                        </td>
                        <td className={`${tdCls} tabular-nums ${isOverdue(a.due_at, a.status) ? "font-medium text-danger" : "text-slate-500"}`}>
                          {a.due_at ? fmtDate(a.due_at) : "—"}
                          {isOverdue(a.due_at, a.status) ? " · overdue" : ""}
                        </td>
                        <td className={tdCls}>
                          {["open", "under_review"].includes(a.status) ? (
                            <Button size="sm" variant="outline" onClick={() => setDecideAlert(a)}>
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
            )}
          </Card>
        )}

        {tab === "Transactions" && (
          <Card>
            <CardHeader
              title="Transactions"
              sub="All recorded business with this customer. Flagged rows were picked up by the monitoring rules."
              action={
                <Button size="sm" onClick={() => setAddTxnOpen(true)}>
                  <IconPlus className="h-4 w-4" /> Record transaction
                </Button>
              }
            />
            {(customer.transactions ?? []).length === 0 ? (
              <EmptyState title="No transactions yet" text="Transactions recorded at the counter will appear here and are monitored automatically." />
            ) : (
              <TableWrap>
                <table className="w-full min-w-[720px]">
                  <thead className="border-b border-line bg-slate-50/70">
                    <tr>
                      <th className={thCls}>Reference</th>
                      <th className={thCls}>Date</th>
                      <th className={thCls}>Description</th>
                      <th className={thCls}>Method</th>
                      <th className={thCls}>Amount</th>
                      <th className={thCls}>Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(customer.transactions ?? []).map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className={`${tdCls} font-mono text-[12px]`}>{t.txn_no}</td>
                        <td className={`${tdCls} tabular-nums`}>{fmtDate(t.txn_date)}</td>
                        <td className={tdCls}>
                          <span className="font-medium text-ink">{t.item_description || humanize(t.type)}</span>
                          <span className="block text-[12px] text-slate-400">
                            {humanize(t.type)}
                            {t.metal_type ? ` · ${humanize(t.metal_type)}` : ""}
                            {t.weight_grams ? ` · ${t.weight_grams} g` : ""}
                          </span>
                        </td>
                        <td className={tdCls}>{humanize(t.payment_method)}</td>
                        <td className={`${tdCls} font-medium tabular-nums text-ink`}>{fmtMoney(t.amount, t.currency)}</td>
                        <td className={tdCls}>
                          {t.flagged ? <Pill tone="red">Flagged</Pill> : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
        )}

        {tab === "Risk" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <p className="text-[12px] font-medium uppercase tracking-wide text-slate-400">Customer risk score</p>
              <div className="mt-3 flex items-end gap-3">
                <span className="font-display text-[44px] font-bold leading-none text-ink tabular-nums">
                  {customer.risk_score ?? "—"}
                </span>
                <span className="pb-1.5 text-[13px] text-slate-400">/ 100</span>
                <span className="pb-1"><RiskPill level={customer.risk_level} /></span>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${customer.risk_level === "low" ? "bg-ok" : customer.risk_level === "medium" ? "bg-warn" : "bg-danger"}`}
                  style={{ width: `${customer.risk_score ?? 0}%` }}
                />
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-slate-500">
                Scores under 30 are low risk, 30–59 medium, 60–79 high and 80 or above severe. A score of
                60 or more makes enhanced due diligence (EDD) mandatory before the customer trades.
              </p>
              <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[13px]">
                <div className="flex justify-between"><dt className="text-slate-400">EDD required</dt><dd className="font-medium text-ink">{customer.edd_required ? "Yes" : "No"}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">EDD status</dt><dd className="font-medium text-ink">{humanize(customer.edd_status)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Next review date</dt><dd className="font-medium text-ink">{fmtDate(customer.next_review_date)}</dd></div>
              </dl>
            </Card>
            <Card className="p-5">
              <p className="font-display text-[14.5px] font-semibold text-ink">What drives this score</p>
              <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-slate-600">
                <li>· <strong className="text-ink">Geography</strong> — nationality {customer.nationality || "not recorded"} and residency ({humanize(customer.residency)}).</li>
                <li>· <strong className="text-ink">Screening outcome</strong> — currently {humanize(customer.screening_status).toLowerCase()}; partial matches and PEP links raise the score materially.</li>
                <li>· <strong className="text-ink">Business profile</strong> — occupation {customer.occupation || "not recorded"}, expected activity {customer.expected_activity || "not stated"}.</li>
                <li>· <strong className="text-ink">Payment behaviour</strong> — cash-heavy expected activity adds risk; monitored continuously under Transaction Monitoring.</li>
              </ul>
              <p className="mt-4 rounded-lg bg-page px-3.5 py-2.5 text-[12px] leading-relaxed text-slate-500">
                The score recalculates whenever the customer record changes or a new screening runs, so
                the level shown here is always the current one.
              </p>
            </Card>
          </div>
        )}

        {tab === "Cases" && (
          <Card>
            <CardHeader
              title="Investigation cases"
              sub="Cases opened from alerts or raised manually for this customer."
              action={
                <Button size="sm" onClick={() => setCaseOpen(true)}>
                  <IconPlus className="h-4 w-4" /> Open case
                </Button>
              }
            />
            {(customer.cases ?? []).length === 0 ? (
              <EmptyState title="No cases for this customer" text="Escalating an alert opens a case automatically, or you can open one manually." />
            ) : (
              <TableWrap>
                <table className="w-full min-w-[640px]">
                  <thead className="border-b border-line bg-slate-50/70">
                    <tr>
                      <th className={thCls}>Case</th>
                      <th className={thCls}>Source</th>
                      <th className={thCls}>Status</th>
                      <th className={thCls}>Opened</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(customer.cases ?? []).map((cs) => (
                      <tr key={cs.id} className="hover:bg-slate-50">
                        <td className={tdCls}>
                          <Link href={`/cases/${cs.id}`} className="font-medium text-ink hover:text-primary">
                            {cs.title}
                          </Link>
                          <span className="block text-[12px] text-slate-400">{cs.case_no}</span>
                        </td>
                        <td className={tdCls}>{humanize(cs.source)}</td>
                        <td className={tdCls}>
                          <Pill tone={caseStatusTone(cs.status)}>{humanize(cs.status)}</Pill>
                        </td>
                        <td className={`${tdCls} tabular-nums`}>{fmtDate(cs.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
        )}
      </div>

      {/* Modals */}
      <ScreeningAlertDecisionModal alert={decideAlert} onClose={() => setDecideAlert(null)} onDone={load} />
      <AddTransactionModal open={addTxnOpen} onClose={() => setAddTxnOpen(false)} onDone={load} fixedCustomer={customer} />
      <AddDocumentModal open={addDocOpen} onClose={() => setAddDocOpen(false)} customerId={customer.id} onDone={load} />
      <VerifyDocumentModal doc={verifyDoc} onClose={() => setVerifyDoc(null)} onDone={load} />
      <NewCaseModal open={caseOpen} onClose={() => setCaseOpen(false)} customer={customer} onDone={load} />

      <Modal
        open={!!kycModal}
        onClose={() => setKycModal(null)}
        title={kycModal === "approve" ? "Approve KYC" : "Reject KYC"}
        sub={customer.full_name}
        footer={
          <>
            <Button variant="outline" onClick={() => setKycModal(null)}>
              Cancel
            </Button>
            <Button variant={kycModal === "reject" ? "danger" : "primary"} disabled={kycBusy} onClick={submitKyc}>
              {kycBusy ? "Saving…" : kycModal === "approve" ? "Approve KYC" : "Reject KYC"}
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-slate-600">
          {kycModal === "approve"
            ? "You are confirming that identity documents have been verified, screening alerts are cleared, and the risk assessment is acceptable. This decision is recorded in the audit trail under your name."
            : "Rejecting KYC closes this file. The customer record is retained for five years, but no transactions may be recorded against it."}
        </p>
        <Field label="Notes (optional)" className="mt-4">
          <Textarea rows={3} value={kycNotes} onChange={(e) => setKycNotes(e.target.value)} placeholder="Basis for the decision…" />
        </Field>
      </Modal>
    </div>
  );
}

/* ---------------- candidates ---------------- */
function CandidateTable({ screening }: { screening: Screening }) {
  const candidates: Candidate[] = Array.isArray(screening.results) ? screening.results : [];
  if (candidates.length === 0) {
    return (
      <div className="p-5">
        <p className="rounded-lg bg-ok-soft px-4 py-3 text-[13px] text-ok">
          No candidate reached the {screening.threshold ?? 70}% similarity threshold in this run — the
          name is clear against the loaded lists.
        </p>
      </div>
    );
  }
  return (
    <TableWrap>
      <table className="w-full min-w-[520px]">
        <thead className="border-b border-line bg-slate-50/70">
          <tr>
            <th className={thCls}>Candidate</th>
            <th className={thCls}>Score</th>
            <th className={thCls}>Lists / programmes</th>
            <th className={thCls}>Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {candidates.map((c, i) => {
            const score = Number(c.score ?? c.match_score ?? 0);
            const lists = c.list_name || c.source_list || (c.datasets || []).join(", ") || "—";
            return (
              <tr key={i} className="hover:bg-slate-50">
                <td className={`${tdCls} font-medium text-ink`}>
                  {c.name || c.full_name || c.matched_name || "Unknown"}
                  {c.caption && <span className="block text-[12px] font-normal text-slate-400">{c.caption}</span>}
                </td>
                <td className={tdCls}>
                  <span className={`font-display text-[15px] font-bold tabular-nums ${score >= 90 ? "text-danger" : score >= 70 ? "text-warn" : "text-slate-600"}`}>
                    {score}%
                  </span>
                </td>
                <td className={`${tdCls} max-w-[220px]`}>
                  <span className="line-clamp-2">{lists}</span>
                  {(c.programmes || []).length > 0 && (
                    <span className="block text-[12px] text-slate-400">{(c.programmes || []).join(", ")}</span>
                  )}
                </td>
                <td className={`${tdCls} text-slate-500`}>
                  {c.dob ? `DOB ${fmtDate(c.dob)}` : ""}
                  {c.nationality ? ` · ${c.nationality}` : ""}
                  {(c.topics || []).length > 0 && <span className="block text-[12px]">{(c.topics || []).map(humanize).join(", ")}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableWrap>
  );
}

/* ---------------- profile tab ---------------- */
function ProfileTab({ customer, onSaved }: { customer: Customer; onSaved: () => Promise<void> | void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    first_name: customer.first_name || "",
    middle_name: customer.middle_name || "",
    last_name: customer.last_name || "",
    name_ar: customer.name_ar || "",
    dob: customer.dob ? customer.dob.slice(0, 10) : "",
    nationality: customer.nationality || "",
    occupation: customer.occupation || "",
    employer: customer.employer || "",
    source_of_funds: customer.source_of_funds || "",
    expected_activity: customer.expected_activity || "",
    email: customer.email || "",
    phone: customer.phone || "",
    whatsapp: customer.whatsapp || "",
    address_line: customer.address_line || "",
    city: customer.city || "",
    country: customer.country || "UAE",
    member_category: customer.member_category || "walk_in",
    residency: customer.residency || "resident",
    notes: customer.notes || "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    try {
      const full = [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(" ").trim();
      await api(`/customers/${customer.id}`, {
        method: "PUT",
        body: { ...form, full_name: full || customer.full_name, dob: form.dob || null },
      });
      toast("Customer record updated. Risk score has been recalculated.");
      await onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the changes.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="First name"><Input value={form.first_name} onChange={set("first_name")} /></Field>
        <Field label="Middle name"><Input value={form.middle_name} onChange={set("middle_name")} /></Field>
        <Field label="Last name"><Input value={form.last_name} onChange={set("last_name")} /></Field>
        <Field label="Name in Arabic"><Input value={form.name_ar} onChange={set("name_ar")} dir="auto" /></Field>
        <Field label="Date of birth"><Input type="date" value={form.dob} onChange={set("dob")} /></Field>
        <Field label="Nationality">
          <Select value={form.nationality} onChange={set("nationality")}>
            <option value="">Select…</option>
            {NATIONALITIES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </Field>
        <Field label="Member category">
          <Select value={form.member_category} onChange={set("member_category")}>
            <option value="walk_in">Walk-in</option>
            <option value="regular">Regular</option>
            <option value="vip">VIP</option>
            <option value="corporate">Corporate account</option>
          </Select>
        </Field>
        <Field label="Residency">
          <Select value={form.residency} onChange={set("residency")}>
            <option value="resident">UAE resident</option>
            <option value="gcc">GCC national</option>
            <option value="non_resident">Non-resident</option>
          </Select>
        </Field>
        <Field label="Occupation"><Input value={form.occupation} onChange={set("occupation")} /></Field>
        <Field label="Employer"><Input value={form.employer} onChange={set("employer")} /></Field>
        <Field label="Source of funds"><Input value={form.source_of_funds} onChange={set("source_of_funds")} /></Field>
        <Field label="Expected activity"><Input value={form.expected_activity} onChange={set("expected_activity")} /></Field>
        <Field label="Email"><Input value={form.email} onChange={set("email")} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
        <Field label="WhatsApp"><Input value={form.whatsapp} onChange={set("whatsapp")} /></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={form.address_line} onChange={set("address_line")} /></Field>
        <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
      </div>
      <Field label="Internal notes" className="mt-4">
        <Textarea rows={3} value={form.notes} onChange={set("notes")} />
      </Field>
      <div className="mt-5 flex justify-end">
        <Button disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </Card>
  );
}

/* ---------------- documents modals ---------------- */
function AddDocumentModal({
  open,
  onClose,
  customerId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  customerId: number;
  onDone: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    doc_type: "emirates_id",
    doc_number: "",
    issuing_country: "United Arab Emirates",
    issue_date: "",
    expiry_date: "",
    file_name: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.doc_number.trim()) {
      toast("Enter the document number.", "error");
      return;
    }
    setBusy(true);
    try {
      await api(`/customers/${customerId}/documents`, {
        method: "POST",
        body: {
          ...form,
          issue_date: form.issue_date || null,
          expiry_date: form.expiry_date || null,
          file_name: form.file_name || `${form.doc_type}-${form.doc_number}.jpg`,
        },
      });
      toast("Document recorded. Complete the verification checklist to verify it.");
      await onDone();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not add the document.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add identity document"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={submit}>{busy ? "Saving…" : "Add document"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Document type" required>
          <Select value={form.doc_type} onChange={set("doc_type")}>
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Document number" required>
          <Input value={form.doc_number} onChange={set("doc_number")} placeholder="e.g. 784-1990-1234555-1" />
        </Field>
        <Field label="Issuing country">
          <Input value={form.issuing_country} onChange={set("issuing_country")} />
        </Field>
        <Field label="Scan file reference">
          <Input value={form.file_name} onChange={set("file_name")} placeholder="emirates-id-front.jpg" />
        </Field>
        <Field label="Issue date">
          <Input type="date" value={form.issue_date} onChange={set("issue_date")} />
        </Field>
        <Field label="Expiry date">
          <Input type="date" value={form.expiry_date} onChange={set("expiry_date")} />
        </Field>
      </div>
    </Modal>
  );
}

function VerifyDocumentModal({
  doc,
  onClose,
  onDone,
}: {
  doc: CustomerDocument | null;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [checklist, setChecklist] = useState<Record<string, string>>({});
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (doc) {
      const init: Record<string, string> = {};
      CHECKLIST_ITEMS.forEach((i) => {
        init[i.key] = doc.verification?.[i.key] || "pending";
      });
      setChecklist(init);
      setVerified(doc.verified);
    }
  }, [doc]);

  if (!doc) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/documents/${doc.id}/verify`, {
        method: "PUT",
        body: { checklist, verified },
      });
      toast(verified ? "Document marked as verified." : "Verification checklist saved.");
      await onDone();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save verification.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!doc}
      onClose={onClose}
      title={`Verify ${humanize(doc.doc_type)}`}
      sub={`${doc.doc_number || ""} · issued ${fmtDate(doc.issue_date)} · expires ${fmtDate(doc.expiry_date)}`}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save verification"}</Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-slate-600">
        Compare the physical document (or its scan) against each point below. A document can only be
        marked verified when every item passes.
      </p>
      <div className="mt-4 space-y-2">
        {CHECKLIST_ITEMS.map((item) => (
          <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3.5 py-2.5">
            <span className="text-[13px] text-slate-700">{item.label}</span>
            <div className="flex overflow-hidden rounded-lg border border-line text-[12px] font-medium">
              {(["pending", "verified", "failed"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setChecklist((c) => ({ ...c, [item.key]: v }))}
                  className={`px-3 py-1.5 capitalize transition ${
                    checklist[item.key] === v
                      ? v === "verified"
                        ? "bg-ok text-white"
                        : v === "failed"
                          ? "bg-danger text-white"
                          : "bg-slate-500 text-white"
                      : "bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-lg bg-page px-3.5 py-3">
        <input
          type="checkbox"
          checked={verified}
          onChange={(e) => setVerified(e.target.checked)}
          className="h-4 w-4 rounded border-line accent-[#0E7569]"
        />
        <span className="text-[13px] font-medium text-ink">
          Mark this document as verified
          <span className="block text-[12px] font-normal text-slate-400">
            Your name and the time are recorded against this verification.
          </span>
        </span>
      </label>
    </Modal>
  );
}

/* ---------------- new case modal ---------------- */
function NewCaseModal({
  open,
  onClose,
  customer,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer;
  onDone: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const submit = async () => {
    if (!title.trim()) {
      toast("Give the case a title.", "error");
      return;
    }
    setBusy(true);
    try {
      const created = await api<CaseItem>("/cases", {
        method: "POST",
        body: { customer_id: customer.id, source: "manual", title, description: description || null, priority },
      });
      toast(`Case ${created.case_no} opened.`);
      await onDone();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not open the case.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Open investigation case"
      sub={customer.full_name}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={submit}>{busy ? "Opening…" : "Open case"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unexplained cash purchases above profile" />
        </Field>
        <Field label="Priority">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </Field>
        <Field label="Description">
          <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What triggered this case, and what should the investigator establish?" />
        </Field>
      </div>
    </Modal>
  );
}
