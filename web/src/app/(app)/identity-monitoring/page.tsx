"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, apiPage } from "@/lib/api";
import type { Customer, CustomerDocument } from "@/lib/types";
import { daysUntil, fmtDate, humanize } from "@/lib/format";
import { Card, EmptyState, PageHeader, PageLoading, Pill, StatCard, TableWrap, tdCls, thCls } from "@/components/ui";

interface DocRow {
  doc: CustomerDocument;
  customer: Customer;
  days: number | null;
}

export default function IdentityMonitoringPage() {
  const [rows, setRows] = useState<DocRow[]>([]);
  const [unverified, setUnverified] = useState<DocRow[]>([]);
  const [noDoc, setNoDoc] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Pull the customer book (seeded workspaces are small; cap at 5 pages of 15).
        const customers: Customer[] = [];
        for (let page = 1; page <= 5; page++) {
          const res = await apiPage<Customer>("/customers", { page });
          customers.push(...res.items);
          if (page >= res.lastPage) break;
        }
        // Fetch documents per customer (list payloads don't embed them).
        const details = await Promise.all(
          customers.map((c) =>
            api<Customer>(`/customers/${c.id}`)
              .then((d) => ({ summary: c, full: d }))
              .catch(() => ({ summary: c, full: null }))
          )
        );
        const expiring: DocRow[] = [];
        const pending: DocRow[] = [];
        const missing: Customer[] = [];
        details.forEach(({ summary, full }) => {
          const docs = full?.documents ?? [];
          if (docs.length === 0) {
            if (summary.status !== "archived" && summary.status !== "rejected") missing.push(summary);
            return;
          }
          docs.forEach((doc) => {
            const days = daysUntil(doc.expiry_date);
            if (days !== null && days <= 60) expiring.push({ doc, customer: summary, days });
            if (!doc.verified) pending.push({ doc, customer: summary, days });
          });
        });
        expiring.sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
        setRows(expiring);
        setUnverified(pending);
        setNoDoc(missing);
      } catch {
        /* leave empty states */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const expiredCount = useMemo(() => rows.filter((r) => (r.days ?? 0) < 0).length, [rows]);

  if (loading) return <PageLoading />;

  return (
    <div>
      <PageHeader
        title="Identity monitoring"
        sub="Documents that are expired, about to expire, or still waiting for verification — plus customers with no identity document on file at all."
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Expired documents" value={expiredCount} sub="renewal must be requested" tone={expiredCount ? "red" : "green"} />
        <StatCard label="Expiring within 60 days" value={rows.length - expiredCount} sub="plan the renewal now" tone="amber" />
        <StatCard label="Awaiting verification" value={unverified.length} sub="checklists outstanding" tone="navy" />
        <StatCard label="No document on file" value={noDoc.length} sub="cannot be KYC-approved" tone={noDoc.length ? "red" : "green"} />
      </div>

      <Card className="mt-4">
        <div className="border-b border-line px-5 py-4">
          <h3 className="font-display text-[15px] font-semibold text-ink">Expiring and expired documents</h3>
          <p className="mt-0.5 text-[12.5px] text-slate-500">Trading with an expired ID is a finding waiting to happen — chase the renewal before the date passes.</p>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="Nothing expiring soon" text="No customer documents expire within the next 60 days." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={thCls}>Customer</th>
                  <th className={thCls}>Document</th>
                  <th className={thCls}>Number</th>
                  <th className={thCls}>Expiry</th>
                  <th className={thCls}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ doc, customer, days }) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className={tdCls}>
                      <Link href={`/customers/${customer.id}`} className="font-medium text-ink hover:text-primary">
                        {customer.full_name}
                      </Link>
                      <span className="block text-[12px] text-slate-400">{customer.customer_no}</span>
                    </td>
                    <td className={tdCls}>{humanize(doc.doc_type)}</td>
                    <td className={`${tdCls} font-mono text-[12px]`}>{doc.doc_number || "—"}</td>
                    <td className={`${tdCls} tabular-nums`}>{fmtDate(doc.expiry_date)}</td>
                    <td className={tdCls}>
                      {days !== null && days < 0 ? (
                        <Pill tone="red">Expired {-days}d ago</Pill>
                      ) : (
                        <Pill tone="amber">{days} days left</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="border-b border-line px-5 py-4">
            <h3 className="font-display text-[15px] font-semibold text-ink">Awaiting verification</h3>
            <p className="mt-0.5 text-[12.5px] text-slate-500">Open the customer file and complete the checklist on the Documents tab.</p>
          </div>
          {unverified.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-slate-400">Every recorded document has been verified.</p>
          ) : (
            <ul className="divide-y divide-line">
              {unverified.map(({ doc, customer }) => (
                <li key={doc.id} className="flex items-center justify-between gap-2 px-5 py-3">
                  <div>
                    <Link href={`/customers/${customer.id}`} className="text-[13.5px] font-medium text-ink hover:text-primary">
                      {customer.full_name}
                    </Link>
                    <p className="text-[12px] text-slate-400">
                      {humanize(doc.doc_type)} · {doc.doc_number || "no number"} · added {fmtDate(doc.created_at)}
                    </p>
                  </div>
                  <Pill tone="amber">Pending</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="border-b border-line px-5 py-4">
            <h3 className="font-display text-[15px] font-semibold text-ink">No identity document on file</h3>
            <p className="mt-0.5 text-[12.5px] text-slate-500">These customers were registered without a document and cannot pass KYC until one is recorded.</p>
          </div>
          {noDoc.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-slate-400">Every active customer has at least one document recorded.</p>
          ) : (
            <ul className="divide-y divide-line">
              {noDoc.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-5 py-3">
                  <div>
                    <Link href={`/customers/${c.id}`} className="text-[13.5px] font-medium text-ink hover:text-primary">
                      {c.full_name}
                    </Link>
                    <p className="text-[12px] text-slate-400">{c.customer_no} · onboarded {fmtDate(c.created_at)}</p>
                  </div>
                  <Pill tone="red">No document</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
