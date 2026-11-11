"use client";

import React, { useEffect, useState } from "react";
import { api, apiList } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { useToast } from "@/lib/toast";
import { Button, Field, Input, Modal, Select } from "./ui";

export function AddTransactionModal({
  open,
  onClose,
  onDone,
  fixedCustomer,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  fixedCustomer?: Customer | null;
}) {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    txn_date: new Date().toISOString().slice(0, 10),
    type: "buy",
    item_description: "",
    metal_type: "gold",
    weight_grams: "",
    amount: "",
    currency: "AED",
    payment_method: "cash",
    channel: "counter",
  });

  useEffect(() => {
    if (open && !fixedCustomer) {
      apiList<Customer>("/customers", { per_page: 100 }).then(setCustomers).catch(() => setCustomers([]));
    }
    if (open && fixedCustomer) {
      setForm((f) => ({ ...f, customer_id: String(fixedCustomer.id) }));
    }
  }, [open, fixedCustomer ]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.customer_id || !form.amount) {
      toast("Select a customer and enter the amount.", "error");
      return;
    }
    setBusy(true);
    try {
      await api("/transactions", {
        method: "POST",
        body: {
          customer_id: Number(form.customer_id),
          txn_date: form.txn_date,
          type: form.type,
          item_description: form.item_description || null,
          metal_type: form.type === "buy" || form.type === "sell" ? form.metal_type : null,
          weight_grams: form.weight_grams ? Number(form.weight_grams) : null,
          amount: Number(form.amount),
          currency: form.currency,
          payment_method: form.payment_method,
          channel: form.channel,
        },
      });
      toast("Transaction recorded. The monitoring rules have been checked against it.");
      onDone();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not record the transaction.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record transaction"
      sub="Transactions are stored against the customer and checked by the monitoring rules immediately."
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Record transaction"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fixedCustomer ? (
          <Field label="Customer">
            <Input value={`${fixedCustomer.full_name} (${fixedCustomer.customer_no})`} disabled />
          </Field>
        ) : (
          <Field label="Customer" required>
            <Select value={form.customer_id} onChange={set("customer_id")}>
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} — {c.customer_no}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Date" required>
          <Input type="date" value={form.txn_date} onChange={set("txn_date")} />
        </Field>
        <Field label="Type" required>
          <Select value={form.type} onChange={set("type")}>
            <option value="buy">Customer buys from us</option>
            <option value="sell">Customer sells to us</option>
            <option value="remittance">Remittance</option>
            <option value="policy">Insurance policy</option>
            <option value="service">Service</option>
          </Select>
        </Field>
        <Field label="Payment method" required>
          <Select value={form.payment_method} onChange={set("payment_method")}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
          </Select>
        </Field>
        <Field label="Description">
          <Input
            value={form.item_description}
            onChange={set("item_description")}
            placeholder="e.g. 22k gold necklace, 48 g"
          />
        </Field>
        <Field label="Channel">
          <Select value={form.channel} onChange={set("channel")}>
            <option value="counter">In store (counter)</option>
            <option value="online">Online</option>
            <option value="phone">Phone</option>
          </Select>
        </Field>
        <Field label="Metal">
          <Select value={form.metal_type} onChange={set("metal_type")}>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="diamond">Diamond</option>
            <option value="platinum">Platinum</option>
          </Select>
        </Field>
        <Field label="Weight (grams)">
          <Input type="number" min="0" step="0.01" value={form.weight_grams} onChange={set("weight_grams")} placeholder="0.00" />
        </Field>
        <Field label="Amount" required>
          <div className="flex gap-2">
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} placeholder="0.00" className="flex-1" />
            <Select value={form.currency} onChange={set("currency")} className="w-24">
              <option value="AED">AED</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="SAR">SAR</option>
              <option value="INR">INR</option>
              <option value="PKR">PKR</option>
            </Select>
          </div>
        </Field>
      </div>
      <p className="mt-4 rounded-lg bg-warn-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-warn">
        Cash transactions of AED 55,000 or more must be reported under the UAE DNFBP rules. Recording
        one here raises a monitoring alert automatically so the MLRO can prepare the report.
      </p>
    </Modal>
  );
}
