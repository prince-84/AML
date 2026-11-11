"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiPage } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { fmtDate, humanize } from "@/lib/format";
import { ButtonLink, Card, EmptyState, Input, PageHeader, PageLoading, Pagination, Select, TableWrap, tdCls, thCls } from "@/components/ui";
import { CustomerStatusPill, KycPill, RiskPill, ScreeningPill } from "@/components/CustomerBits";
import { IconPlus, IconSearch } from "@/components/icons";

function CustomersInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState(sp.get("search") || "");
  const [status, setStatus] = useState("");
  const [risk, setRisk] = useState("");
  const [screening, setScreening] = useState("");
  const [kyc, setKyc] = useState(sp.get("kyc_status") || "");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiPage<Customer>("/customers", {
        search: search || undefined,
        status: status || undefined,
        risk_level: risk || undefined,
        screening_status: screening || undefined,
        kyc_status: kyc || undefined,
        page,
      });
      setRows(res.items);
      setTotal(res.total);
      setLastPage(res.lastPage);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, status, risk, screening, kyc, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const resetPage = (fn: () => void) => () => {
    setPage(1);
    fn();
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        sub="Every customer is identified, screened and risk-scored before they can trade. Records are kept for a minimum of five years."
        actions={
          <ButtonLink href="/customers/new">
            <IconPlus className="h-4 w-4" /> Add customer
          </ButtonLink>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => resetPage(() => setSearch(e.target.value))()}
              placeholder="Search by name, customer number, phone or ID…"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
            <Select value={status} onChange={(e) => resetPage(() => setStatus(e.target.value))()}>
              <option value="">All statuses</option>
              <option value="pending_kyc">Pending KYC</option>
              <option value="active">Active</option>
              <option value="restricted">Restricted</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </Select>
            <Select value={screening} onChange={(e) => resetPage(() => setScreening(e.target.value))()}>
              <option value="">Screening: any</option>
              <option value="not_screened">Not screened</option>
              <option value="clear">Clear</option>
              <option value="potential_match">Potential match</option>
              <option value="under_review">Under review</option>
              <option value="confirmed_match">Confirmed match</option>
            </Select>
            <Select value={risk} onChange={(e) => resetPage(() => setRisk(e.target.value))()}>
              <option value="">Risk: any</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="severe">Severe</option>
            </Select>
            <Select value={kyc} onChange={(e) => resetPage(() => setKyc(e.target.value))()}>
              <option value="">KYC: any</option>
              <option value="pending">KYC pending</option>
              <option value="approved">KYC approved</option>
              <option value="rejected">KYC rejected</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <PageLoading />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No customers match these filters"
            text="Try widening the search, or onboard a new customer to start the due-diligence process."
            action={
              <ButtonLink href="/customers/new" size="sm">
                <IconPlus className="h-4 w-4" /> Add customer
              </ButtonLink>
            }
          />
        ) : (
          <>
            <TableWrap>
              <table className="w-full min-w-[880px] border-collapse">
                <thead className="border-b border-line bg-slate-50/70">
                  <tr>
                    <th className={thCls}>Customer</th>
                    <th className={thCls}>Nationality</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>KYC</th>
                    <th className={thCls}>Screening</th>
                    <th className={thCls}>Risk</th>
                    <th className={thCls}>Onboarded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      className="cursor-pointer transition hover:bg-slate-50"
                      onClick={() => router.push(`/customers/${c.id}`)}
                    >
                      <td className={tdCls}>
                        <Link
                          href={`/customers/${c.id}`}
                          className="font-medium text-ink hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.full_name}
                        </Link>
                        <span className="block text-[12px] text-slate-400">
                          {c.customer_no} · {humanize(c.member_category || c.type)}
                          {c.name_ar ? ` · ${c.name_ar}` : ""}
                        </span>
                      </td>
                      <td className={tdCls}>{c.nationality || "—"}</td>
                      <td className={tdCls}>
                        <CustomerStatusPill status={c.status} />
                      </td>
                      <td className={tdCls}>
                        <KycPill status={c.kyc_status} />
                      </td>
                      <td className={tdCls}>
                        <ScreeningPill status={c.screening_status} />
                      </td>
                      <td className={tdCls}>
                        <RiskPill level={c.risk_level} score={c.risk_score} />
                      </td>
                      <td className={`${tdCls} tabular-nums text-slate-500`}>{fmtDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CustomersInner />
    </Suspense>
  );
}
