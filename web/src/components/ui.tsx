"use client";

import React from "react";
import Link from "next/link";
import type { Tone } from "@/lib/format";
import { IconChevronLeft, IconChevronRight, IconX } from "./icons";

/* ---------- Card ---------- */
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(15,42,67,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>
        {sub && <p className="mt-0.5 text-[12.5px] text-slate-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-[22px] font-bold leading-tight text-ink">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-[13px] text-slate-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Pill / Chip ---------- */
const toneCls: Record<Tone, string> = {
  teal: "bg-primary-soft text-primary-dark",
  green: "bg-ok-soft text-ok",
  amber: "bg-warn-soft text-warn",
  red: "bg-danger-soft text-danger",
  slate: "bg-slate-100 text-slate-600",
  navy: "bg-[#e8eef5] text-ink",
};
const dotCls: Record<Tone, string> = {
  teal: "bg-primary",
  green: "bg-ok",
  amber: "bg-warn",
  red: "bg-danger",
  slate: "bg-slate-400",
  navy: "bg-ink",
};

export function Pill({
  tone = "slate",
  children,
  dot = true,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${toneCls[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotCls[tone]}`} />}
      {children}
    </span>
  );
}
export const Chip = Pill;

/* ---------- Buttons ---------- */
type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "navy";
const btnCls: Record<BtnVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark shadow-sm",
  navy: "bg-ink text-white hover:bg-[#0a1f33] shadow-sm",
  outline: "border border-line bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-danger text-white hover:bg-[#b91c1c] shadow-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        size === "sm" ? "px-3 py-1.5 text-[12.5px]" : "px-4 py-2 text-[13px]"
      } ${btnCls[variant]} ${className}`}
    />
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: BtnVariant;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors ${
        size === "sm" ? "px-3 py-1.5 text-[12.5px]" : "px-4 py-2 text-[13px]"
      } ${btnCls[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

/* ---------- Form controls ---------- */
export const inputCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50";

export function Field({
  label,
  children,
  hint,
  required,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-slate-400">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className || ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className || ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputCls} appearance-none pr-8 ${props.className || ""}`}>
      {props.children}
    </select>
  );
}

/* ---------- Stat card ---------- */
export function StatCard({
  label,
  value,
  sub,
  tone = "teal",
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: Tone;
  href?: string;
}) {
  const bar: Record<Tone, string> = {
    teal: "bg-primary",
    green: "bg-ok",
    amber: "bg-warn",
    red: "bg-danger",
    slate: "bg-slate-300",
    navy: "bg-ink",
  };
  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${bar[tone]}`} />
        <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <p className="mt-2 font-display text-[26px] font-bold leading-none text-ink tabular-nums">
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[12px] text-slate-500">{sub}</p>}
    </>
  );
  const cls = "block rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(15,42,67,0.04)]";
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-primary/40`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/* ---------- Table helpers ---------- */
export const thCls =
  "px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-slate-500";
export const tdCls = "px-4 py-3 text-[13px] text-slate-700 align-middle";

export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="scroll-thin overflow-x-auto">{children}</div>;
}

/* ---------- Empty state ---------- */
export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <p className="mt-3 font-display text-[14.5px] font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[12.5px] text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({
  page,
  lastPage,
  total,
  onChange,
}: {
  page: number;
  lastPage: number;
  total?: number;
  onChange: (p: number) => void;
}) {
  if (lastPage <= 1 && !total) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3">
      <p className="text-[12px] text-slate-500">
        {total !== undefined ? `${total} record${total === 1 ? "" : "s"} · ` : ""}Page {page} of{" "}
        {Math.max(lastPage, 1)}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          aria-label="Previous page"
        >
          <IconChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= lastPage}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          aria-label="Next page"
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        aria-label="Close dialog"
        className="fade-in absolute inset-0 bg-ink/45"
        onClick={onClose}
      />
      <div
        className={`fade-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 className="font-display text-[16px] font-semibold text-ink">{title}</h3>
            {sub && <p className="mt-0.5 text-[12.5px] text-slate-500">{sub}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
            aria-label="Close"
          >
            <IconX className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-slate-50 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Loading helpers ---------- */
export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin text-primary ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10v3a7 7 0 0 1 7 7h3z" fill="currentColor" />
    </svg>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-9 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-slate-500">
      <Spinner />
      <span className="text-[13px]">Loading…</span>
    </div>
  );
}

/* ---------- Toggle switch ---------- */
export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
