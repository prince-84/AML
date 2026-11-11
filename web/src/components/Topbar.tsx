"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { humanize, initials } from "@/lib/format";
import { IconChevronDown, IconLogout, IconMenu, IconSearch } from "./icons";
import { Pill } from "./ui";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, company, logout } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/customers?search=${encodeURIComponent(q.trim())}` : "/customers");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="flex h-[60px] items-center gap-3 px-4 sm:px-6">
        <button
          onClick={onMenu}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <IconMenu className="h-5 w-5" />
        </button>

        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <span className="truncate font-display text-[14px] font-semibold text-ink">
            {company?.name || "Your company"}
          </span>
          {company?.plan && (
            <Pill tone="teal" dot={false}>
              {humanize(company.plan)} plan
            </Pill>
          )}
        </div>

        <form onSubmit={submitSearch} className="relative mx-auto w-full max-w-md flex-1 px-2">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customers by name, number or ID…"
            className="w-full rounded-lg border border-line bg-page py-2 pl-9 pr-3 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
          />
        </form>

        <div className="hidden items-center gap-2 xl:flex">
          <Pill tone="green">Screening engine ready</Pill>
          {typeof company?.screening_credits_used === "number" && (
            <span className="text-[12px] tabular-nums text-slate-500">
              {company.screening_credits_used} credits used this month
            </span>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-slate-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink font-display text-[12px] font-semibold text-white">
              {initials(user?.name)}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[130px] truncate text-[12.5px] font-semibold text-ink">
                {user?.name || "User"}
              </span>
              <span className="block text-[11px] capitalize text-slate-400">
                {humanize(user?.role)}
              </span>
            </span>
            <IconChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          {menuOpen && (
            <div className="fade-in absolute right-0 top-[calc(100%+6px)] w-60 rounded-xl border border-line bg-white p-1.5 shadow-xl shadow-slate-900/5">
              <div className="border-b border-line px-3 py-2.5">
                <p className="truncate text-[13px] font-semibold text-ink">{user?.name}</p>
                <p className="truncate text-[12px] text-slate-500">{user?.email}</p>
                <p className="mt-1 text-[11.5px] text-slate-400">
                  {company?.name} · {humanize(user?.role)}
                </p>
              </div>
              <button
                onClick={() => router.push("/settings/company")}
                className="mt-1 w-full rounded-lg px-3 py-2 text-left text-[13px] text-slate-600 transition hover:bg-slate-50"
              >
                Company settings
              </button>
              <button
                onClick={() => void logout()}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-danger transition hover:bg-danger-soft"
              >
                <IconLogout className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
