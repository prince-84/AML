"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Spinner } from "./ui";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-slate-500">
        <Spinner />
        <span className="text-[13px]">Loading workspace…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="lg:pl-[248px]">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">{children}</main>
        <footer className="mx-auto w-full max-w-[1440px] px-4 pb-8 sm:px-6">
          <p className="border-t border-line pt-4 text-[11.5px] text-slate-400">
            ComplyShield · Compliance that never sleeps. Screening data: OpenSanctions and official
            OFAC, EU, UN and UK lists, refreshed nightly.
          </p>
        </footer>
      </div>
    </div>
  );
}
