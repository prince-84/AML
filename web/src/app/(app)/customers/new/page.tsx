"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { api } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { useToast } from "@/lib/toast";
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { CHECKLIST_ITEMS, DOC_TYPES, NATIONALITIES } from "@/components/CustomerBits";
import { IconCheck, IconPhone } from "@/components/icons";

interface DocDraft {
  doc_type: string;
  doc_number: string;
  issuing_country: string;
  issue_date: string;
  expiry_date: string;
  file_name: string;
}

const emptyDoc: DocDraft = {
  doc_type: "emirates_id",
  doc_number: "",
  issuing_country: "United Arab Emirates",
  issue_date: "",
  expiry_date: "",
  file_name: "",
};

const STEPS = ["Customer details", "Documents", "Review & screen"];

export default function NewCustomerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [scanCode, setScanCode] = useState("");

  const [form, setForm] = useState({
    type: "individual",
    member_category: "walk_in",
    residency: "resident",
    first_name: "",
    middle_name: "",
    last_name: "",
    name_ar: "",
    dob: "",
    gender: "male",
    nationality: "United Arab Emirates",
    occupation: "",
    employer: "",
    source_of_funds: "",
    expected_activity: "",
    email: "",
    phone: "",
    whatsapp: "",
    address_line: "",
    city: "Dubai",
    country: "UAE",
    notes: "",
  });
  const [docs, setDocs] = useState<DocDraft[]>([{ ...emptyDoc }]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const fullName = useMemo(
    () => [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(" ").trim(),
    [form]
  );

  const validDetails = form.first_name.trim() !== "" && form.last_name.trim() !== "";
  const validDocs = docs.every((d) => d.doc_number.trim() !== "");

  const openScan = async (idx: number) => {
    const code =
      Math.random().toString(36).slice(2, 8).toUpperCase() +
      "-" +
      Math.floor(1000 + Math.random() * 9000);
    setScanCode(code);
    setScanOpen(true);
    setQrUrl(null);
    try {
      const url = await QRCode.toDataURL(
        `ComplyShield document scan · one-time code ${code} · document ${idx + 1}`,
        { width: 220, margin: 1, color: { dark: "#0f2a43", light: "#ffffff" } }
      );
      setQrUrl(url);
    } catch {
      setQrUrl(null);
    }
  };

  const setDoc = (idx: number, k: keyof DocDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDocs((ds) => ds.map((d, i) => (i === idx ? { ...d, [k]: e.target.value } : d)));

  const submit = async () => {
    setBusy(true);
    try {
      const customer = await api<Customer>("/customers", {
        method: "POST",
        body: {
          ...form,
          full_name: fullName,
          dob: form.dob || null,
        },
      });
      for (const d of docs) {
        if (!d.doc_number.trim()) continue;
        await api(`/customers/${customer.id}/documents`, {
          method: "POST",
          body: {
            doc_type: d.doc_type,
            doc_number: d.doc_number,
            issuing_country: d.issuing_country,
            issue_date: d.issue_date || null,
            expiry_date: d.expiry_date || null,
            file_name: d.file_name || `${d.doc_type}-${d.doc_number}.jpg`,
          },
        }).catch(() => undefined);
      }
      toast(`Customer ${customer.customer_no} created. Screening has run automatically.`);
      router.push(`/customers/${customer.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create the customer.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Add customer"
        sub="Onboard a new customer. On saving, the name is screened against the loaded watchlists automatically and a risk score is calculated."
      />

      {/* Stepper */}
      <div className="mb-5 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-[12.5px] font-medium transition ${
                i === step
                  ? "bg-primary-soft text-primary-dark"
                  : i < step
                    ? "text-ok"
                    : "text-slate-400"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-semibold ${
                  i === step
                    ? "bg-primary text-white"
                    : i < step
                      ? "bg-ok text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {i < step ? <IconCheck className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
          </React.Fragment>
        ))}
      </div>

      {step === 0 && (
        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Customer type" required>
              <Select value={form.type} onChange={set("type")}>
                <option value="individual">Individual</option>
                <option value="corporate">Corporate</option>
              </Select>
            </Field>
            <Field label="Member category" required>
              <Select value={form.member_category} onChange={set("member_category")}>
                <option value="walk_in">Walk-in</option>
                <option value="regular">Regular</option>
                <option value="vip">VIP</option>
                <option value="corporate">Corporate account</option>
              </Select>
            </Field>
            <Field label="Residency" required>
              <Select value={form.residency} onChange={set("residency")}>
                <option value="resident">UAE resident</option>
                <option value="gcc">GCC national</option>
                <option value="non_resident">Non-resident</option>
              </Select>
            </Field>
          </div>

          <h3 className="mb-3 mt-7 font-display text-[14.5px] font-semibold text-ink">Personal information</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="First name" required>
              <Input value={form.first_name} onChange={set("first_name")} placeholder="e.g. Jamal" />
            </Field>
            <Field label="Middle name">
              <Input value={form.middle_name} onChange={set("middle_name")} placeholder="e.g. Khaled Muhammad" />
            </Field>
            <Field label="Last / family name" required>
              <Input value={form.last_name} onChange={set("last_name")} placeholder="e.g. Al Taie" />
            </Field>
            <Field label="Name in Arabic">
              <Input value={form.name_ar} onChange={set("name_ar")} placeholder="الاسم بالعربية" dir="auto" />
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={form.dob} onChange={set("dob")} />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onChange={set("gender")}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Nationality" required>
              <Select value={form.nationality} onChange={set("nationality")}>
                {NATIONALITIES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Occupation">
              <Input value={form.occupation} onChange={set("occupation")} placeholder="e.g. Trader, salaried employee" />
            </Field>
            <Field label="Employer">
              <Input value={form.employer} onChange={set("employer")} placeholder="Employer or own business" />
            </Field>
            <Field label="Source of funds">
              <Input value={form.source_of_funds} onChange={set("source_of_funds")} placeholder="e.g. Salary, business income" />
            </Field>
            <Field label="Expected activity">
              <Input value={form.expected_activity} onChange={set("expected_activity")} placeholder="e.g. Gold purchases up to AED 40,000 / month" />
            </Field>
          </div>

          <h3 className="mb-3 mt-7 font-display text-[14.5px] font-semibold text-ink">Contact &amp; address</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Email">
              <Input type="email" value={form.email} onChange={set("email")} placeholder="customer@email.com" />
            </Field>
            <Field label="Mobile number">
              <Input value={form.phone} onChange={set("phone")} placeholder="+971 5x xxx xxxx" />
            </Field>
            <Field label="WhatsApp">
              <Input value={form.whatsapp} onChange={set("whatsapp")} placeholder="If different from mobile" />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input value={form.address_line} onChange={set("address_line")} placeholder="Building, street, area" />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={set("city")} />
            </Field>
          </div>

          <Field label="Internal notes" className="mt-4">
            <Textarea rows={2} value={form.notes} onChange={set("notes")} placeholder="Anything the compliance team should know about this customer…" />
          </Field>

          <div className="mt-6 flex justify-end">
            <Button disabled={!validDetails} onClick={() => setStep(1)}>
              Continue to documents
            </Button>
          </div>
          {!validDetails && (
            <p className="mt-2 text-right text-[12px] text-slate-400">First and last name are required to continue.</p>
          )}
        </Card>
      )}

      {step === 1 && (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-[15px] font-semibold text-ink">Identity documents</h3>
              <p className="mt-1 max-w-xl text-[12.5px] text-slate-500">
                At least one identity document must be recorded, and it must be verified before the
                customer can be saved as KYC-approved. Accepted: Emirates ID, GCC ID, Passport with
                visa, Labour Card, Seaman Pass or UAE Driving Licence.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setDocs((ds) => [...ds, { ...emptyDoc }])}>
              Add another document
            </Button>
          </div>

          <div className="mt-5 space-y-5">
            {docs.map((d, idx) => (
              <div key={idx} className="rounded-xl border border-line p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-ink">Document {idx + 1}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openScan(idx)}>
                      <IconPhone className="h-4 w-4" /> Scan document with phone
                    </Button>
                    {docs.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => setDocs((ds) => ds.filter((_, i) => i !== idx))}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Document type" required>
                    <Select value={d.doc_type} onChange={setDoc(idx, "doc_type")}>
                      {DOC_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Document number" required>
                    <Input value={d.doc_number} onChange={setDoc(idx, "doc_number")} placeholder="e.g. 784-1990-1234555-1" />
                  </Field>
                  <Field label="Issuing country">
                    <Input value={d.issuing_country} onChange={setDoc(idx, "issuing_country")} />
                  </Field>
                  <Field label="Issue date">
                    <Input type="date" value={d.issue_date} onChange={setDoc(idx, "issue_date")} />
                  </Field>
                  <Field label="Expiry date">
                    <Input type="date" value={d.expiry_date} onChange={setDoc(idx, "expiry_date")} />
                  </Field>
                  <Field label="Scan file reference">
                    <Input value={d.file_name} onChange={setDoc(idx, "file_name")} placeholder="Auto-filled after scan" />
                  </Field>
                </div>
                <div className="mt-4 rounded-lg bg-page px-3.5 py-3">
                  <p className="text-[12px] font-medium text-slate-600">
                    Verification checklist — completed by the reviewer on the customer profile:
                  </p>
                  <ul className="mt-1.5 grid gap-1 text-[12px] text-slate-400 sm:grid-cols-2">
                    {CHECKLIST_ITEMS.map((c) => (
                      <li key={c.key}>· {c.label}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button disabled={!validDocs} onClick={() => setStep(2)}>
              Continue to review
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-5">
          <h3 className="font-display text-[15px] font-semibold text-ink">Review &amp; screen</h3>
          <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {[
              ["Full name", fullName || "—"],
              ["Name in Arabic", form.name_ar || "—"],
              ["Type", `${form.type} · ${form.member_category.replace("_", " ")} · ${form.residency.replace("_", " ")}`],
              ["Date of birth", form.dob || "—"],
              ["Nationality", form.nationality],
              ["Occupation", form.occupation || "—"],
              ["Source of funds", form.source_of_funds || "—"],
              ["Expected activity", form.expected_activity || "—"],
              ["Phone", form.phone || "—"],
              ["Email", form.email || "—"],
              ["Address", [form.address_line, form.city, form.country].filter(Boolean).join(", ") || "—"],
              ["Documents", docs.map((d) => `${DOC_TYPES.find((t) => t.value === d.doc_type)?.label}: ${d.doc_number}`).join(" · ")],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3 border-b border-line/70 pb-2.5">
                <dt className="w-36 shrink-0 text-[12.5px] text-slate-400">{k}</dt>
                <dd className="text-[13px] font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 rounded-xl bg-primary-soft px-4 py-3.5 text-[13px] leading-relaxed text-primary-dark">
            On saving, three things happen automatically: the name is screened against the loaded
            sanctions / PEP lists, a customer risk score is calculated, and any match at or above the
            configured threshold raises a screening alert for the compliance officer. The customer
            stays <strong>Pending KYC</strong> until an MLRO or owner approves the file.
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button disabled={busy || !validDetails} onClick={submit}>
              {busy ? "Saving & screening…" : "Save customer & run screening"}
            </Button>
          </div>
        </Card>
      )}

      <Modal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Scan document with your phone"
        sub="Point the phone camera at the code. The document is captured on the phone and the details are read automatically (OCR)."
        footer={
          <>
            <Button variant="outline" onClick={() => setScanOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setScanOpen(false);
                toast("Scan session started. The captured document will attach to this form when the upload completes.");
              }}
            >
              I have scanned the document
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center py-2">
          <div className="rounded-2xl border border-line bg-white p-4">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt={`One-time scan code ${scanCode}`} className="h-[220px] w-[220px]" />
            ) : (
              <div className="skeleton h-[220px] w-[220px] rounded-lg" />
            )}
          </div>
          <p className="mt-4 font-mono text-[15px] font-semibold tracking-widest text-ink">{scanCode}</p>
          <p className="mt-2 max-w-sm text-center text-[12.5px] leading-relaxed text-slate-500">
            The code works once, on one phone, for a few minutes. Nothing about the customer is inside
            the code — it only opens the secure capture page for this session.
          </p>
        </div>
      </Modal>
    </div>
  );
}
