"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, apiDownload, apiList } from "@/lib/api";
import type { StrReport } from "@/lib/types";
import { canDecide, useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { fmtDate, fmtMoney, humanize, strStatusTone } from "@/lib/format";
import {
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  PageLoading,
  Pill,
  StatCard,
  TableWrap,
  tdCls,
  thCls,
} from "@/components/ui";
import { IconDownload, IconEye } from "@/components/icons";

export default function ReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const privileged = canDecide(user?.role);
  const [reports, setReports] = useState<StrReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<StrReport | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [filing, setFiling] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setReports(await apiList<StrReport>("/str-reports", { per_page: 100 }));
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openReport = async (r: StrReport) => {
    setViewing(r);
    if (!r.goaml_xml) {
      setViewLoading(true);
      try {
        const res = await api<any>(`/str-reports/${r.id}`);
        setViewing((res?.str_report ?? res) as StrReport);
      } catch {
        /* keep the list copy */
      } finally {
        setViewLoading(false);
      }
    }
  };

  const downloadXml = async (r: StrReport) => {
    try {
      let blob: Blob;
      try {
        blob = await apiDownload(`/str-reports/${r.id}/goaml`);
      } catch {
        const rawFull = viewing?.id === r.id && viewing.goaml_xml ? viewing : await api<any>(`/str-reports/${r.id}`);
        const full = ((rawFull as any)?.str_report ?? rawFull) as StrReport;
        if (!full.goaml_xml) throw new Error("No goAML file is attached to this report yet.");
        blob = new Blob([full.goaml_xml], { type: "application/xml" });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${r.report_no || `str-${r.id}`}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Download failed.", "error");
    }
  };

  const markFiled = async (r: StrReport) => {
    setFiling(r.id);
    try {
      await api(`/str-reports/${r.id}`, { method: "PUT", body: { status: "filed" } });
      toast(`${r.report_type} ${r.report_no} marked as filed. The case timeline has been updated.`);
      if (viewing?.id === r.id) setViewing({ ...r, status: "filed", filed_at: new Date().toISOString() });
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not mark the report as filed.", "error");
    } finally {
      setFiling(null);
    }
  };

  if (loading) return <PageLoading />;

  const drafts = reports.filter((r) => r.status === "draft").length;
  const underReview = reports.filter((r) => r.status === "under_review").length;
  const filed = reports.filter((r) => r.status === "filed").length;

  return (
    <div>
      <PageHeader
        title="Reports — STR / SAR"
        sub="Suspicious transaction and activity reports prepared for the UAE Financial Intelligence Unit. Drafts carry a goAML XML file; the MLRO files it on the goAML portal and marks it filed here."
        actions={<Link href="/cases" className="text-[13px] font-medium text-primary hover:underline">Open a case to start a report</Link>}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Total reports" value={reports.length} sub="STR and SAR combined" />
        <StatCard label="Drafts" value={drafts} sub="waiting for MLRO review" tone="amber" />
        <StatCard label="Under review" value={underReview} sub="with the MLRO now" tone="navy" />
        <StatCard label="Filed" value={filed} sub="submitted to the FIU" tone="green" />
      </div>

      <Card className="mt-4">
        {reports.length === 0 ? (
          <EmptyState
            title="No reports yet"
            text="Reports are drafted from investigation cases. When a case cannot be explained away, the MLRO creates the STR from the case page and it appears here."
            action={
              <Link href="/cases" className="text-[13px] font-medium text-primary hover:underline">
                Go to investigation cases
              </Link>
            }
          />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={thCls}>Report</th>
                  <th className={thCls}>Customer</th>
                  <th className={thCls}>Reason</th>
                  <th className={thCls}>Amount involved</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Created</th>
                  <th className={thCls}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className={tdCls}>
                      <span className="font-medium text-ink">{r.report_no}</span>
                      <span className="block text-[12px] text-slate-400">
                        {r.report_type}
                        {r.case ? ` · case ${r.case.case_no}` : ""}
                      </span>
                    </td>
                    <td className={tdCls}>
                      {r.customer ? (
                        <Link href={`/customers/${r.customer.id}`} className="font-medium text-ink hover:text-primary">
                          {r.customer.full_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${tdCls} max-w-[260px]`}>
                      <span className="line-clamp-2">{r.reason || "—"}</span>
                    </td>
                    <td className={`${tdCls} tabular-nums`}>{fmtMoney(r.amount_involved)}</td>
                    <td className={tdCls}>
                      <Pill tone={strStatusTone(r.status)}>{humanize(r.status)}</Pill>
                      {r.filed_at && <span className="block text-[11.5px] text-slate-400">{fmtDate(r.filed_at)}</span>}
                    </td>
                    <td className={`${tdCls} tabular-nums`}>{fmtDate(r.created_at)}</td>
                    <td className={tdCls}>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => openReport(r)}>
                          <IconEye className="h-3.5 w-3.5" /> View
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => downloadXml(r)}>
                          <IconDownload className="h-3.5 w-3.5" /> XML
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.report_type} ${viewing.report_no}` : ""}
        sub={viewing?.customer ? `Subject: ${viewing.customer.full_name}` : undefined}
        wide
        footer={
          viewing ? (
            <>
              <Button variant="outline" onClick={() => downloadXml(viewing)}>
                <IconDownload className="h-4 w-4" /> Download goAML XML
              </Button>
              {viewing.status !== "filed" &&
                (privileged ? (
                  <Button disabled={filing === viewing.id} onClick={() => markFiled(viewing)}>
                    {filing === viewing.id ? "Marking…" : "Mark as filed"}
                  </Button>
                ) : (
                  <span className="text-[12px] text-slate-400">Only the MLRO or owner can mark a report filed.</span>
                ))}
            </>
          ) : undefined
        }
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Pill tone={strStatusTone(viewing.status)}>{humanize(viewing.status)}</Pill>
              <Pill tone="slate" dot={false}>
                Amount involved: {fmtMoney(viewing.amount_involved)}
              </Pill>
              {viewing.filed_at && (
                <Pill tone="green" dot={false}>
                  Filed {fmtDate(viewing.filed_at)}
                </Pill>
              )}
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Reason for suspicion</p>
              <p className="mt-1 text-[13.5px] text-slate-700">{viewing.reason || "—"}</p>
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Narrative</p>
              <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-slate-700">
                {viewing.narrative || "No narrative recorded."}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">goAML XML</p>
              {viewLoading ? (
                <p className="mt-1 text-[13px] text-slate-400">Loading the generated file…</p>
              ) : viewing.goaml_xml ? (
                <pre className="scroll-thin mt-1 max-h-64 overflow-auto rounded-lg bg-ink p-4 font-mono text-[11.5px] leading-relaxed text-slate-100">
                  {viewing.goaml_xml}
                </pre>
              ) : (
                <p className="mt-1 text-[13px] text-slate-400">
                  The goAML file is generated when the draft is created; use the download button to fetch
                  it from the server.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
