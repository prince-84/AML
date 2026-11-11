"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPage } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { fmtDate, humanize } from "@/lib/format";
import { Card, EmptyState, PageHeader, PageLoading, TableWrap, tdCls, thCls } from "@/components/ui";
import { KycPill, RiskPill, ScreeningPill } from "@/components/CustomerBits";

export default function RiskRegisterPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiPage<Customer>("/customers", { risk_level: "high", page: 1 }).catch(() => ({ items: [] as Customer[] })),
      apiPage<Customer>("/customers", { risk_level: "severe", page: 1 }).catch(() => ({ items: [] as Customer[] })),
    ]).then(([h, s]) => {
      const merged = [...s.items, ...h.items].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
      setRows(merged);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Risk register"
        sub="Every customer currently scored high or severe. These files need enhanced due diligence, senior approval to trade, and more frequent review."
      />
      <Card>
        {loading ? (
          <PageLoading />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No high-risk customers"
            text="Customers whose risk score reaches 60 or more will be listed here automatically, highest score first."
          />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={thCls}>Customer</th>
                  <th className={thCls}>Nationality</th>
                  <th className={thCls}>Risk</th>
                  <th className={thCls}>Screening</th>
                  <th className={thCls}>KYC</th>
                  <th className={thCls}>EDD</th>
                  <th className={thCls}>Next review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/customers/${c.id}`)}>
                    <td className={tdCls}>
                      <Link href={`/customers/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:text-primary">
                        {c.full_name}
                      </Link>
                      <span className="block text-[12px] text-slate-400">{c.customer_no}</span>
                    </td>
                    <td className={tdCls}>{c.nationality || "—"}</td>
                    <td className={tdCls}>
                      <RiskPill level={c.risk_level} score={c.risk_score} />
                    </td>
                    <td className={tdCls}>
                      <ScreeningPill status={c.screening_status} />
                    </td>
                    <td className={tdCls}>
                      <KycPill status={c.kyc_status} />
                    </td>
                    <td className={tdCls}>
                      {c.edd_required ? humanize(c.edd_status || "pending") : <span className="text-slate-400">Not required</span>}
                    </td>
                    <td className={`${tdCls} tabular-nums`}>{c.next_review_date ? fmtDate(c.next_review_date) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
        Scores refresh automatically whenever a customer record changes or a new screening runs, so this
        register is always current. Scores of 60+ trigger mandatory EDD; 80+ should be escalated to the
        MLRO before any further business.
      </p>
    </div>
  );
}
