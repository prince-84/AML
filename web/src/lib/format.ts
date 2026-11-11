export function humanize(value?: string | null): string {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return (
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

export function fmtMoney(value: number | string | null | undefined, currency = "AED"): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${currency} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function timeAgo(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return "";
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(value);
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export type Tone = "teal" | "green" | "amber" | "red" | "slate" | "navy";

export function riskTone(level?: string | null): Tone {
  switch (level) {
    case "low":
      return "green";
    case "medium":
      return "amber";
    case "high":
      return "red";
    case "severe":
      return "red";
    default:
      return "slate";
  }
}

export function screeningTone(status?: string | null): Tone {
  switch (status) {
    case "clear":
      return "green";
    case "potential_match":
      return "amber";
    case "under_review":
      return "amber";
    case "confirmed_match":
    case "confirmed":
      return "red";
    default:
      return "slate";
  }
}

export function kycTone(status?: string | null): Tone {
  switch (status) {
    case "approved":
      return "green";
    case "rejected":
      return "red";
    default:
      return "amber";
  }
}

export function customerStatusTone(status?: string | null): Tone {
  switch (status) {
    case "active":
      return "green";
    case "restricted":
      return "red";
    case "rejected":
      return "red";
    case "archived":
      return "slate";
    default:
      return "amber";
  }
}

export function priorityTone(priority?: string | null): Tone {
  switch (priority) {
    case "high":
      return "red";
    case "review":
      return "amber";
    case "low":
      return "slate";
    default:
      return "slate";
  }
}

export function severityTone(severity?: string | null): Tone {
  switch (severity) {
    case "high":
    case "severe":
      return "red";
    case "medium":
      return "amber";
    default:
      return "slate";
  }
}

export function alertStatusTone(status?: string | null): Tone {
  switch (status) {
    case "open":
      return "red";
    case "under_review":
      return "amber";
    case "cleared_false_positive":
    case "closed_benign":
    case "closed_no_action":
      return "green";
    case "confirmed_match":
    case "escalated":
    case "escalated_to_case":
      return "navy";
    default:
      return "slate";
  }
}

export function caseStatusTone(status?: string | null): Tone {
  switch (status) {
    case "open":
      return "red";
    case "investigating":
      return "amber";
    case "pending_mlro":
      return "amber";
    case "str_filed":
      return "navy";
    case "closed_no_action":
    case "customer_exited":
      return "slate";
    default:
      return "slate";
  }
}

export function strStatusTone(status?: string | null): Tone {
  switch (status) {
    case "filed":
      return "green";
    case "under_review":
      return "amber";
    default:
      return "slate";
  }
}

export function isOverdue(due?: string | null, status?: string | null): boolean {
  if (!due) return false;
  if (status && !["open", "under_review"].includes(status)) return false;
  return new Date(due).getTime() < Date.now();
}

export function daysUntil(value?: string | null): number | null {
  if (!value) return null;
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}
