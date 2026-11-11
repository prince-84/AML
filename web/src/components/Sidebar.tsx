"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  IconActivity,
  IconAlert,
  IconBriefcase,
  IconBuilding,
  IconCard,
  IconClipboard,
  IconFileText,
  IconGlobe,
  IconGrid,
  IconIdCard,
  IconLayers,
  IconListChecks,
  IconScan,
  IconShield,
  IconSliders,
  IconSwap,
  IconUsers,
  IconX,
} from "./icons";

interface NavItem {
  label: string;
  href: string;
  icon: (p: { className?: string }) => React.ReactNode;
  match?: string;
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: IconGrid },
      { label: "Reports", href: "/reports", icon: IconFileText },
    ],
  },
  {
    title: "Customer Management",
    items: [
      { label: "Customers", href: "/customers", icon: IconUsers, match: "/customers" },
      { label: "Customer Form Builder", href: "/settings/form-builder", icon: IconClipboard },
      { label: "Identity Monitoring", href: "/identity-monitoring", icon: IconIdCard },
    ],
  },
  {
    title: "Transaction Management",
    items: [
      { label: "Transactions", href: "/transactions", icon: IconSwap, exact: true },
      {
        label: "Validation Exceptions",
        href: "/transactions?tab=exceptions",
        icon: IconAlert,
        match: "exceptions",
      },
    ],
  },
  {
    title: "Transaction Monitoring",
    items: [
      { label: "Monitor", href: "/monitoring", icon: IconActivity, exact: true },
      { label: "Alerts", href: "/monitoring/alerts", icon: IconAlert },
      { label: "Rules", href: "/monitoring/rules", icon: IconSliders },
    ],
  },
  {
    title: "AML Screening",
    items: [
      { label: "Name Checker", href: "/screening/name-checker", icon: IconScan },
      { label: "Bulk Screening", href: "/screening/bulk", icon: IconLayers },
      { label: "Screening Configuration", href: "/screening/configuration", icon: IconSliders },
      { label: "Screening Alerts", href: "/screening/alerts", icon: IconAlert },
      { label: "Adverse Media", href: "/screening/adverse-media", icon: IconGlobe },
      { label: "Investigation Cases", href: "/cases", icon: IconBriefcase, match: "/cases" },
      { label: "Screening Monitor", href: "/screening/monitor", icon: IconActivity },
    ],
  },
  {
    title: "Risk Management",
    items: [
      { label: "Enterprise Risk Assessment", href: "/risk/ewra", icon: IconClipboard },
      { label: "Risk Register", href: "/risk/register", icon: IconListChecks },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Company", href: "/settings/company", icon: IconBuilding },
      { label: "Users & Roles", href: "/settings/users", icon: IconUsers },
      { label: "Subscription & Usage", href: "/settings/usage", icon: IconCard },
    ],
  },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  const isActive = (item: NavItem): boolean => {
    if (item.match === "exceptions") return pathname === "/transactions" && tab === "exceptions";
    if (item.href === "/transactions") return pathname === "/transactions" && tab !== "exceptions";
    if (item.exact) return pathname === item.href;
    if (item.match) return pathname === item.match || pathname.startsWith(item.match + "/");
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-white">
          <IconShield className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-[16px] font-bold text-ink">ComplyShield</p>
          <p className="text-[11px] text-slate-400">AML / CFT Compliance</p>
        </div>
      </div>
      <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-6">
        {NAV.map((section) => (
          <div key={section.title} className="mt-5 first:mt-1">
            <p className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors ${
                        active
                          ? "bg-primary-soft font-semibold text-primary-dark"
                          : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                      }`}
                    >
                      <Icon className={`h-[17px] w-[17px] shrink-0 ${active ? "text-primary" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-5 py-3.5">
        <p className="text-[11px] leading-relaxed text-slate-400">
          Screening lists synced nightly at 01:30 GST.
        </p>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-line bg-white lg:block">
        <React.Suspense fallback={null}>
          <NavContent />
        </React.Suspense>
      </aside>
      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button aria-label="Close menu" className="fade-in absolute inset-0 bg-ink/45" onClick={onClose} />
          <aside className="fade-in absolute inset-y-0 left-0 w-[264px] bg-white shadow-2xl">
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <IconX className="h-4 w-4" />
            </button>
            <React.Suspense fallback={null}>
              <NavContent onNavigate={onClose} />
            </React.Suspense>
          </aside>
        </div>
      )}
    </>
  );
}
