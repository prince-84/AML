"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, apiPage } from "@/lib/api";
import type { TmAlert, Transaction } from "@/lib/types";
import { fmtDate, fmtDateTime, fmtMoney, humanize, riskTone, severityTone } from "@/lib/format";
import { useToast } from "@/lib/toast";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  PageLoading,
  Pagination,
  Pill,
  Select,
  StatCard,
  TableWrap,
  tdCls,
  thCls,
} from "@/components/ui";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { TmAlertDecisionModal } from "@/components/DecisionModals";
import { IconAlert, IconCheck, IconEye, IconPlus, IconRefresh, IconSearch, IconShield } from "@/components/icons";

interface StatsData {
  total_transactions: number;
  total_volume: number;
  flagged_count: number;
  flagged_volume: number;
  open_alerts_count: number;
  high_severity_count: number;
}

function getRuleInfo(ruleCode?: string) {
  switch (ruleCode) {
    case "CASH_THRESHOLD":
      return {
        label: "Cash Threshold",
        badge: "Cash ≥ AED 55k",
        tone: "red" as const,
        description: "Single cash transaction meets or exceeds the UAE AML cash reporting limit (AED 55,000).",
      };
    case "STRUCTURING":
      return {
        label: "Structuring Pattern",
        badge: "Split Cash Pattern",
        tone: "red" as const,
        description: "Multiple cash transactions just below reporting threshold within 24 hours.",
      };
    case "HIGH_RISK_CUSTOMER":
      return {
        label: "High-Risk Customer",
        badge: "High-Risk Customer",
        tone: "red" as const,
        description: "Transaction conducted by a customer rated high or severe risk in AML screening.",
      };
    case "HIGH_VALUE":
      return {
        label: "High Value",
        badge: "High Value",
        tone: "amber" as const,
        description: "Transaction amount significantly exceeds standard expected profile.",
      };
    case "RAPID_SUCCESSION":
      return {
        label: "Rapid Succession",
        badge: "Rapid Activity",
        tone: "amber" as const,
        description: "Multiple transactions executed in unusually rapid succession.",
      };
    default:
      return {
        label: ruleCode ? humanize(ruleCode) : "AML Exception",
        badge: ruleCode ? humanize(ruleCode) : "Flagged",
        tone: "red" as const,
        description: "Flagged by transaction monitoring rule.",
      };
  }
}

function alertStatusTone(status?: string) {
  switch (status) {
    case "open":
      return "red" as const;
    case "under_review":
      return "amber" as const;
    case "closed_benign":
      return "green" as const;
    case "escalated_to_case":
      return "navy" as const;
    default:
      return "slate" as const;
  }
}

function TransactionsInner() {
  const sp = useSearchParams();
  const { toast } = useToast();
  const exceptions = sp.get("tab") === "exceptions";

  const [search, setSearch] = useState("");
  const [ruleCode, setRuleCode] = useState("");
  const [alertStatus, setAlertStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [decideAlert, setDecideAlert] = useState<TmAlert | null>(null);
  const [detailTxn, setDetailTxn] = useState<Transaction | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await api<StatsData>("/transactions/stats");
      setStats(data);
    } catch {
      // stats fallback
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiPage<Transaction>("/transactions", {
        search: search || undefined,
        flagged: exceptions ? 1 : undefined,
        rule_code: ruleCode || undefined,
        alert_status: alertStatus || undefined,
        payment_method: paymentMethod || undefined,
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
  }, [search, exceptions, ruleCode, alertStatus, paymentMethod, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    setPage(1);
  }, [exceptions, ruleCode, alertStatus, paymentMethod]);

  const runMonitor = async () => {
    setRunning(true);
    try {
      const res = await api<{ alerts_created?: number; created?: number; scanned?: number }>(
        "/transactions/run-monitor",
        { method: "POST" }
      );
      const created = res?.alerts_created ?? res?.created ?? 0;
      toast(
        created > 0
          ? `Monitoring run complete: ${created} new alert${created === 1 ? "" : "s"} raised.`
          : "Monitoring run complete: no new alerts. All transactions are within rule thresholds."
      );
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Monitoring run failed.", "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={exceptions ? "Validation Exceptions" : "Transactions"}
        sub={
          exceptions
            ? "Transactions flagged by automated AML monitoring rules — large cash threshold breaches (≥ AED 55,000), structured patterns, and transactions by high-risk customers."
            : "Every transaction recorded across your counters with automated compliance monitoring rules applied in real time."
        }
        actions={
          <>
            <Button variant="outline" onClick={runMonitor} disabled={running}>
              <IconRefresh className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
              {running ? "Scanning rules…" : "Run monitor"}
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <IconPlus className="h-4 w-4" /> Record transaction
            </Button>
          </>
        }
      />

      {/* Overview Stat Cards when in Exceptions tab */}
      {exceptions && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Flagged Exceptions"
            value={stats ? `${stats.flagged_count}` : total.toString()}
            sub="Transactions breaching AML rules"
            tone="red"
          />
          <StatCard
            label="Total Flagged Volume"
            value={stats ? fmtMoney(stats.flagged_volume, "AED") : "—"}
            sub="Aggregate exposure on exceptions"
            tone="amber"
          />
          <StatCard
            label="Open Alerts Requiring Action"
            value={stats ? `${stats.open_alerts_count}` : "—"}
            sub="Awaiting MLRO / officer decision"
            tone="red"
          />
          <StatCard
            label="High Severity Triggers"
            value={stats ? `${stats.high_severity_count}` : "—"}
            sub="Critical / High risk transactions"
            tone="navy"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-line">
        <Link
          href="/transactions"
          className={`flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-medium transition ${!exceptions
              ? "border-b-2 border-primary text-primary-dark"
              : "text-slate-500 hover:text-ink"
            }`}
        >
          All transactions
          {stats && stats.total_transactions > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {stats.total_transactions}
            </span>
          )}
        </Link>
        <Link
          href="/transactions?tab=exceptions"
          className={`flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-medium transition ${exceptions
              ? "border-b-2 border-primary text-primary-dark"
              : "text-slate-500 hover:text-ink"
            }`}
        >
          Validation exceptions
          {stats && stats.flagged_count > 0 && (
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">
              {stats.flagged_count}
            </span>
          )}
        </Link>
      </div>

      <Card>
        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search reference, customer or description…"
              className="pl-9"
            />
          </div>

          {exceptions && (
            <>
              <div className="w-52">
                <Select
                  value={ruleCode}
                  onChange={(e) => {
                    setPage(1);
                    setRuleCode(e.target.value);
                  }}
                >
                  <option value="">All Exception Rules</option>
                  <option value="CASH_THRESHOLD">Cash Threshold (≥ AED 55k)</option>
                  <option value="STRUCTURING">Structuring (Split Cash)</option>
                  <option value="HIGH_RISK_CUSTOMER">High-Risk Customer</option>
                  <option value="HIGH_VALUE">High Value Transaction</option>
                  <option value="RAPID_SUCCESSION">Rapid Succession</option>
                </Select>
              </div>

              <div className="w-44">
                <Select
                  value={alertStatus}
                  onChange={(e) => {
                    setPage(1);
                    setAlertStatus(e.target.value);
                  }}
                >
                  <option value="">All Alert Statuses</option>
                  <option value="open">Open (Action Needed)</option>
                  <option value="under_review">Under Review</option>
                  <option value="closed_benign">Closed · Benign</option>
                  <option value="escalated_to_case">Escalated to Case</option>
                </Select>
              </div>
            </>
          )}

          <div className="w-40">
            <Select
              value={paymentMethod}
              onChange={(e) => {
                setPage(1);
                setPaymentMethod(e.target.value);
              }}
            >
              <option value="">All Methods</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
              <option value="cheque">Cheque</option>
            </Select>
          </div>

          {(search || ruleCode || alertStatus || paymentMethod) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setRuleCode("");
                setAlertStatus("");
                setPaymentMethod("");
                setPage(1);
              }}
            >
              Reset filters
            </Button>
          )}
        </div>

        {loading ? (
          <PageLoading />
        ) : rows.length === 0 ? (
          <EmptyState
            title={exceptions ? "No flagged transactions found" : "No transactions recorded yet"}
            text={
              exceptions
                ? "No transactions match your exception filter. Flagged transactions and rule breaches will appear here automatically."
                : "Record transactions at the counter and monitoring rules will evaluate them immediately."
            }
            action={
              !exceptions ? (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <IconPlus className="h-4 w-4" /> Record transaction
                </Button>
              ) : undefined
            }
          />
        ) : exceptions ? (
          /* ==============================================================
             VALIDATION EXCEPTIONS TABLE VIEW: Clear, Informative & Actionable
             ============================================================== */
          <>
            <TableWrap>
              <table className="w-full min-w-[1050px]">
                <thead className="border-b border-line bg-slate-50/75">
                  <tr>
                    <th className={thCls}>Reference & Date</th>
                    <th className={thCls}>Customer & AML Risk</th>
                    <th className={thCls}>Description / Item</th>
                    <th className={thCls}>Amount & Method</th>
                    <th className={thCls}>Triggered Exception & Reason</th>
                    <th className={thCls}>Severity & Status</th>
                    <th className={`${thCls} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((t) => {
                    const primaryAlert = t.tm_alerts && t.tm_alerts.length > 0 ? t.tm_alerts[0] : null;
                    const ruleInfo = getRuleInfo(primaryAlert?.rule_code);
                    const riskLevel = t.customer?.risk_level;
                    const isCash = t.payment_method === "cash";

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/90 transition-colors">
                        {/* Reference & Date */}
                        <td className={tdCls}>
                          <button
                            onClick={() => setDetailTxn(t)}
                            className="font-mono text-[12.5px] font-bold text-primary-dark hover:underline"
                          >
                            {t.txn_no}
                          </button>
                          <div className="mt-0.5 text-[11.5px] text-slate-400">
                            {fmtDate(t.txn_date)} · {humanize(t.channel)}
                          </div>
                        </td>

                        {/* Customer & Risk */}
                        <td className={tdCls}>
                          {t.customer ? (
                            <div>
                              <Link
                                href={`/customers/${t.customer.id}`}
                                className="font-semibold text-ink hover:text-primary transition-colors"
                              >
                                {t.customer.full_name}
                              </Link>
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-mono text-slate-400">
                                  {t.customer.customer_no}
                                </span>
                                {riskLevel && (
                                  <Pill tone={riskTone(riskLevel)} dot={true}>
                                    {humanize(riskLevel)} {t.customer.risk_score ? `(${t.customer.risk_score})` : ""}
                                  </Pill>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Customer #{t.customer_id}</span>
                          )}
                        </td>

                        {/* Item Details */}
                        <td className={tdCls}>
                          <span className="font-medium text-ink block">
                            {t.item_description || humanize(t.type)}
                          </span>
                          <span className="text-[11.5px] text-slate-400">
                            {humanize(t.type)}
                            {t.metal_type ? ` · ${humanize(t.metal_type)}` : ""}
                            {t.weight_grams ? ` · ${t.weight_grams} g` : ""}
                          </span>
                        </td>

                        {/* Amount & Method */}
                        <td className={tdCls}>
                          <span className="font-bold text-[13.5px] tabular-nums text-ink block">
                            {fmtMoney(t.amount, t.currency)}
                          </span>
                          <span
                            className={`mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${isCash
                                ? "border border-amber-300 bg-amber-50 text-amber-800"
                                : "border border-slate-200 bg-slate-50 text-slate-600"
                              }`}
                          >
                            {humanize(t.payment_method)}
                          </span>
                        </td>

                        {/* Triggered Exception & Details */}
                        <td className={`${tdCls} max-w-xs`}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Pill tone={ruleInfo.tone} dot={true}>
                              {ruleInfo.badge}
                            </Pill>
                            {t.tm_alerts && t.tm_alerts.length > 1 && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                +{t.tm_alerts.length - 1} more
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[12px] leading-snug text-slate-600 line-clamp-2">
                            {primaryAlert?.description || primaryAlert?.title || ruleInfo.description}
                          </p>
                        </td>

                        {/* Severity & Status */}
                        <td className={tdCls}>
                          <div className="space-y-1">
                            {primaryAlert && (
                              <div>
                                <Pill tone={severityTone(primaryAlert.severity)}>
                                  {humanize(primaryAlert.severity)} severity
                                </Pill>
                              </div>
                            )}
                            <div>
                              <Pill tone={alertStatusTone(primaryAlert?.status)}>
                                {humanize(primaryAlert?.status || "open")}
                              </Pill>
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className={`${tdCls} text-right`}>
                          <div className="flex items-center justify-end gap-1.5">
                            {primaryAlert && primaryAlert.status === "open" ? (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => setDecideAlert(primaryAlert)}
                              >
                                Review Alert
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDetailTxn(t)}
                              >
                                <IconEye className="h-3.5 w-3.5" /> Details
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
          </>
        ) : (
          /* ==============================================================
             ALL TRANSACTIONS TABLE VIEW
             ============================================================== */
          <>
            <TableWrap>
              <table className="w-full min-w-[880px]">
                <thead className="border-b border-line bg-slate-50/75">
                  <tr>
                    <th className={thCls}>Reference</th>
                    <th className={thCls}>Date</th>
                    <th className={thCls}>Customer</th>
                    <th className={thCls}>Description</th>
                    <th className={thCls}>Method</th>
                    <th className={thCls}>Amount</th>
                    <th className={thCls}>Compliance Flag</th>
                    <th className={`${thCls} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((t) => {
                    const primaryAlert = t.tm_alerts && t.tm_alerts.length > 0 ? t.tm_alerts[0] : null;
                    const ruleInfo = getRuleInfo(primaryAlert?.rule_code);

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/90 transition-colors">
                        <td className={`${tdCls} font-mono text-[12.5px] font-semibold text-ink`}>
                          {t.txn_no}
                        </td>
                        <td className={`${tdCls} tabular-nums`}>{fmtDate(t.txn_date)}</td>
                        <td className={tdCls}>
                          {t.customer ? (
                            <Link
                              href={`/customers/${t.customer.id}`}
                              className="font-medium text-ink hover:text-primary transition-colors"
                            >
                              {t.customer.full_name}
                            </Link>
                          ) : (
                            <span className="text-slate-400">Customer #{t.customer_id}</span>
                          )}
                        </td>
                        <td className={tdCls}>
                          <span className="font-medium text-ink">{t.item_description || humanize(t.type)}</span>
                          <span className="block text-[11.5px] text-slate-400">
                            {humanize(t.type)}
                            {t.metal_type ? ` · ${humanize(t.metal_type)}` : ""}
                            {t.weight_grams ? ` · ${t.weight_grams} g` : ""} · {humanize(t.channel)}
                          </span>
                        </td>
                        <td className={tdCls}>{humanize(t.payment_method)}</td>
                        <td className={`${tdCls} font-bold tabular-nums text-ink`}>
                          {fmtMoney(t.amount, t.currency)}
                        </td>
                        <td className={tdCls}>
                          {t.flagged ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Pill tone={ruleInfo.tone} dot={true}>
                                {ruleInfo.badge}
                              </Pill>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-medium">—</span>
                          )}
                        </td>
                        <td className={`${tdCls} text-right`}>
                          <Button size="sm" variant="ghost" onClick={() => setDetailTxn(t)}>
                            <IconEye className="h-3.5 w-3.5" /> View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
          </>
        )}
      </Card>

      {/* Record New Transaction Modal */}
      <AddTransactionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onDone={() => {
          void load();
          void loadStats();
        }}
      />

      {/* Transaction Alert Decision Modal */}
      <TmAlertDecisionModal
        alert={decideAlert}
        onClose={() => setDecideAlert(null)}
        onDone={() => {
          void load();
          void loadStats();
        }}
      />

      {/* Detailed Transaction Audit Modal */}
      {detailTxn && (
        <Modal
          open={!!detailTxn}
          onClose={() => setDetailTxn(null)}
          title={`Transaction Audit: ${detailTxn.txn_no}`}
          sub={`Recorded on ${fmtDate(detailTxn.txn_date)} · Status: ${humanize(detailTxn.status || "completed")}`}
          wide={true}
          footer={
            <div className="flex w-full items-center justify-between">
              <div>
                {detailTxn.flagged ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-danger">
                    <IconAlert className="h-4 w-4" /> Flagged by AML Rules
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ok">
                    <IconCheck className="h-4 w-4" /> Clean Transaction
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {detailTxn.tm_alerts && detailTxn.tm_alerts.length > 0 && detailTxn.tm_alerts[0].status === "open" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const alert = detailTxn.tm_alerts?.[0];
                      setDetailTxn(null);
                      if (alert) setDecideAlert(alert);
                    }}
                  >
                    Decide Alert
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setDetailTxn(null)}>
                  Close
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Top metrics grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-line bg-slate-50/60 p-3.5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Amount</p>
                <p className="mt-0.5 font-display text-[17px] font-bold text-ink">
                  {fmtMoney(detailTxn.amount, detailTxn.currency)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Payment Method</p>
                <p className="mt-0.5 text-[13.5px] font-semibold text-ink">
                  {humanize(detailTxn.payment_method)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Channel</p>
                <p className="mt-0.5 text-[13.5px] font-semibold text-ink">
                  {humanize(detailTxn.channel)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Weight & Metal</p>
                <p className="mt-0.5 text-[13.5px] font-semibold text-ink">
                  {detailTxn.weight_grams ? `${detailTxn.weight_grams} g` : "—"}{" "}
                  {detailTxn.metal_type ? `(${humanize(detailTxn.metal_type)})` : ""}
                </p>
              </div>
            </div>

            {/* Customer Information */}
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h4 className="font-display text-[14px] font-bold text-ink">Customer Compliance Profile</h4>
                {detailTxn.customer && (
                  <Link
                    href={`/customers/${detailTxn.customer.id}`}
                    className="text-[12px] font-medium text-primary hover:underline"
                  >
                    View Full Profile →
                  </Link>
                )}
              </div>
              {detailTxn.customer ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 text-[12.5px]">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Full Name</span>
                    <span className="font-semibold text-ink">{detailTxn.customer.full_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Customer No</span>
                    <span className="font-mono text-ink">{detailTxn.customer.customer_no}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Risk Rating</span>
                    <div className="mt-0.5">
                      <Pill tone={riskTone(detailTxn.customer.risk_level)} dot={true}>
                        {humanize(detailTxn.customer.risk_level || "Not assessed")}{" "}
                        {detailTxn.customer.risk_score ? `(Score: ${detailTxn.customer.risk_score})` : ""}
                      </Pill>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[12.5px] text-slate-500">Customer record #{detailTxn.customer_id}</p>
              )}
            </div>

            {/* Compliance Alerts & Exception Reasons */}
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h4 className="font-display text-[14px] font-bold text-ink flex items-center gap-2">
                  <IconShield className="h-4 w-4 text-primary" /> Triggered Monitoring Exceptions
                </h4>
                <span className="text-[12px] text-slate-500 font-medium">
                  {detailTxn.tm_alerts?.length || 0} alert(s)
                </span>
              </div>

              {detailTxn.tm_alerts && detailTxn.tm_alerts.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {detailTxn.tm_alerts.map((a) => {
                    const rule = getRuleInfo(a.rule_code);
                    return (
                      <div
                        key={a.id}
                        className="rounded-lg border border-danger/25 bg-danger-soft/20 p-3.5 text-[12.5px]"
                      >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-ink">{a.title}</span>
                              <Pill tone={rule.tone}>{rule.label}</Pill>
                            </div>
                            <p className="mt-1 font-mono text-[11px] text-slate-500">
                              Rule: {a.rule_code} · Raised {fmtDateTime(a.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Pill tone={severityTone(a.severity)}>{humanize(a.severity)} severity</Pill>
                            <Pill tone={alertStatusTone(a.status)}>{humanize(a.status)}</Pill>
                          </div>
                        </div>

                        <p className="mt-2.5 text-slate-700 leading-relaxed bg-white/80 p-2.5 rounded border border-danger/10">
                          {a.description || rule.description}
                        </p>

                        {a.notes && (
                          <div className="mt-2 rounded bg-white/90 p-2 text-[11.5px] text-slate-600 border border-slate-200">
                            <span className="font-semibold text-slate-800">Officer Decision Notes:</span> {a.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-lg bg-slate-50 p-4 text-center text-[12.5px] text-slate-500">
                  No automated exception alerts triggered for this transaction.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <TransactionsInner />
    </Suspense>
  );
}
