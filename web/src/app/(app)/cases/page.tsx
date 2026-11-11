"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, apiList, apiPage } from "@/lib/api";
import type { CaseItem, Customer } from "@/lib/types";
import { caseStatusTone, fmtDate, humanize } from "@/lib/format";
import { useToast } from "@/lib/toast";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  PageLoading,
  Pagination,
  Pill,
  Select,
  TableWrap,
  Textarea,
  tdCls,
  thCls,
  Input,
} from "@/components/ui";
import { IconPlus } from "@/components/icons";

export default function CasesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<CaseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({ customer_id: "", title: "", description: "", priority: "medium", source: "manual" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiPage<CaseItem>("/cases", { status: status || undefined, page });
      setRows(res.items);
      setTotal(res.total);
      setLastPage(res.lastPage);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (createOpen) {
      apiList<Customer>("/customers", { per_page: 100 }).then(setCustomers).catch(() => setCustomers([]));
    }
  }, [createOpen]);

  const create = async () => {
    if (!form.customer_id || !form.title.trim()) {
      toast("Select a customer and give the case a title.", "error");
      return;
    }
    setBusy(true);
    try {
      const created = await api<CaseItem>("/cases", {
        method: "POST",
        body: {
          customer_id: Number(form.customer_id),
          title: form.title,
          description: form.description || null,
          priority: form.priority,
          source: form.source,
        },
      });
      toast(`Case ${created.case_no} opened.`);
      setCreateOpen(false);
      router.push(`/cases/${created.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not open the case.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Investigation cases"
        sub="Escalated alerts and manually raised investigations. A case is where evidence is gathered, the MLRO decides, and an STR is prepared if the activity stays unexplained."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus className="h-4 w-4" /> Open case
          </Button>
        }
      />
      <Card>
        <div className="border-b border-line px-4 py-3.5">
          <Select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="w-56"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="pending_mlro">Pending MLRO</option>
            <option value="closed_no_action">Closed — no action</option>
            <option value="str_filed">STR filed</option>
            <option value="customer_exited">Customer exited</option>
          </Select>
        </div>
        {loading ? (
          <PageLoading />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No cases with this status"
            text="Cases are created by escalating a screening or transaction alert, or opened manually when something needs a closer look."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Open a case manually
              </Button>
            }
          />
        ) : (
          <>
            <TableWrap>
              <table className="w-full min-w-[820px]">
                <thead className="border-b border-line bg-slate-50/70">
                  <tr>
                    <th className={thCls}>Case</th>
                    <th className={thCls}>Customer</th>
                    <th className={thCls}>Source</th>
                    <th className={thCls}>Priority</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Opened</th>
                    <th className={thCls}>Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((c) => (
                    <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/cases/${c.id}`)}>
                      <td className={tdCls}>
                        <span className="font-medium text-ink">{c.title}</span>
                        <span className="block text-[12px] text-slate-400">{c.case_no}</span>
                      </td>
                      <td className={tdCls}>
                        {c.customer ? (
                          <Link href={`/customers/${c.customer.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:text-primary">
                            {c.customer.full_name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={tdCls}>{humanize(c.source)}</td>
                      <td className={tdCls}>
                        <Pill tone={c.priority === "high" ? "red" : c.priority === "low" ? "slate" : "amber"}>
                          {humanize(c.priority || "medium")}
                        </Pill>
                      </td>
                      <td className={tdCls}>
                        <Pill tone={caseStatusTone(c.status)}>{humanize(c.status)}</Pill>
                      </td>
                      <td className={`${tdCls} tabular-nums`}>{fmtDate(c.created_at)}</td>
                      <td className={`${tdCls} tabular-nums`}>{c.due_at ? fmtDate(c.due_at) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
          </>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Open investigation case"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={create}>
              {busy ? "Opening…" : "Open case"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Customer" required>
            <Select value={form.customer_id} onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}>
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} — {c.customer_no}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title" required>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Possible structuring across three branches"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source">
              <Select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                <option value="manual">Manual</option>
                <option value="screening">Screening</option>
                <option value="transaction">Transaction</option>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What triggered this case, and what needs to be established?"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
