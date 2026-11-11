"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getToken } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { IconShield } from "@/components/icons";
import { Button, Field, Input } from "@/components/ui";

const DEMO = [
  { label: "Owner", email: "owner@alnoor.example", name: "Ahmed Al Mansoori" },
  { label: "MLRO", email: "mlro@alnoor.example", name: "Sara Iqbal" },
  { label: "Officer", email: "officer@alnoor.example", name: "Omar Farouk" },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      toast("Welcome back. Your compliance workspace is ready.");
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-ink px-10 py-10 text-white lg:flex xl:px-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary text-white">
              <IconShield className="h-5.5 w-5.5" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-[19px] font-bold">ComplyShield</p>
              <p className="text-[11.5px] text-slate-300">Compliance that never sleeps.</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-[34px] font-bold leading-[1.15]">
            AML compliance for the businesses the law now covers.
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-slate-300">
            Customer due diligence, sanctions and PEP screening, transaction monitoring and goAML
            reporting — one workspace for jewellery, real estate, insurance and audit firms working
            under UAE Federal Decree-Law No. 10 of 2025.
          </p>
          <ul className="mt-7 space-y-3 text-[13.5px] text-slate-200">
            <li className="flex gap-2.5">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Screen a walk-in customer against OFAC, EU, UN, UK and PEP lists in under a second.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Every decision leaves an audit trail your MLRO can stand behind at inspection.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Draft STRs in minutes and export them in goAML format, ready to file.
            </li>
          </ul>
        </div>

        <div className="relative grid grid-cols-3 gap-4 border-t border-white/15 pt-6">
          <div>
            <p className="font-display text-[22px] font-bold tabular-nums">15+</p>
            <p className="text-[11.5px] text-slate-300">sanctions &amp; PEP lists</p>
          </div>
          <div>
            <p className="font-display text-[22px] font-bold tabular-nums">&lt; 1 sec</p>
            <p className="text-[11.5px] text-slate-300">average screening time</p>
          </div>
          <div>
            <p className="font-display text-[22px] font-bold tabular-nums">5 yrs</p>
            <p className="text-[11.5px] text-slate-300">records retained per UAE law</p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-white">
              <IconShield className="h-5 w-5" />
            </span>
            <p className="font-display text-[17px] font-bold text-ink">ComplyShield</p>
          </div>

          <h2 className="font-display text-[24px] font-bold text-ink">Sign in to your workspace</h2>
          <p className="mt-1.5 text-[13.5px] text-slate-500">
            Use the account your compliance administrator issued you.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="Work email" required>
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Password" required>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {error && (
              <div className="rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-[12.5px] text-danger">
                {error}
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full py-2.5">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-8 rounded-xl border border-line bg-page p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              Demo workspace — Al Noor Gold &amp; Jewellery LLC
            </p>
            <p className="mt-1 text-[12.5px] text-slate-500">
              Password for every demo account is <span className="font-mono font-medium text-ink">password</span>.
              Tap an account to fill the form.
            </p>
            <div className="mt-3 space-y-1.5">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword("password");
                    setError(null);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-left transition hover:border-primary/50"
                >
                  <span>
                    <span className="block text-[12.5px] font-medium text-ink">{d.email}</span>
                    <span className="block text-[11.5px] text-slate-400">{d.name}</span>
                  </span>
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary-dark">
                    {d.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-[11.5px] leading-relaxed text-slate-400">
            Protected by role-based access. All screening activity is logged for audit.
          </p>
        </div>
      </div>
    </div>
  );
}
