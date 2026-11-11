"use client";

import React from "react";
import type { Customer } from "@/lib/types";
import {
  customerStatusTone,
  humanize,
  kycTone,
  riskTone,
  screeningTone,
} from "@/lib/format";
import { Pill } from "./ui";

export function RiskPill({ level, score }: { level?: string | null; score?: number | null }) {
  if (!level) return <span className="text-slate-400">Not scored</span>;
  return (
    <Pill tone={riskTone(level)}>
      {humanize(level)}
      {typeof score === "number" ? ` · ${score}` : ""}
    </Pill>
  );
}

export function ScreeningPill({ status }: { status?: string | null }) {
  return <Pill tone={screeningTone(status)}>{humanize(status)}</Pill>;
}

export function KycPill({ status }: { status?: string | null }) {
  return <Pill tone={kycTone(status)}>{humanize(status)}</Pill>;
}

export function CustomerStatusPill({ status }: { status?: string | null }) {
  return <Pill tone={customerStatusTone(status)}>{humanize(status)}</Pill>;
}

export function customerAlerts(c: Customer) {
  return c.alerts ?? c.screening_alerts ?? [];
}

export const DOC_TYPES: { value: string; label: string }[] = [
  { value: "emirates_id", label: "Emirates ID" },
  { value: "gcc_id", label: "GCC ID" },
  { value: "passport", label: "Passport" },
  { value: "labor_card", label: "Labour Card" },
  { value: "driving_license", label: "UAE Driving Licence" },
  { value: "visa", label: "Passport with Visa" },
  { value: "trade_license", label: "Trade Licence" },
];

export const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: "clarity", label: "Image is clear and readable" },
  { key: "all_sides", label: "Every side / page of the document is present" },
  { key: "number_matches", label: "Document number matches the record" },
  { key: "dates_valid", label: "Issue and expiry dates are valid" },
  { key: "details_match", label: "Details match the customer's personal information" },
  { key: "authenticity", label: "Reviewer assessment: document appears authentic" },
];

export const NATIONALITIES = [
  "United Arab Emirates", "India", "Pakistan", "Bangladesh", "Philippines", "Egypt",
  "Jordan", "Lebanon", "Syria", "Yemen", "Sudan", "Iraq", "Saudi Arabia", "Kuwait",
  "Oman", "Qatar", "Bahrain", "United Kingdom", "United States", "Russia", "Ukraine",
  "China", "Iran", "Afghanistan", "Nigeria", "Kenya", "Sri Lanka", "Nepal", "Indonesia",
  "Turkey", "Germany", "France", "Italy", "Spain", "Canada", "Australia", "Other",
];
