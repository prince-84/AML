"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ScreeningAlert, TmAlert } from "@/lib/types";
import { canDecide, useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { humanize } from "@/lib/format";
import { Button, Field, Modal, Select, Textarea } from "./ui";
import { Pill } from "./ui";
import { priorityTone } from "@/lib/format";

export function ScreeningAlertDecisionModal({
  alert,
  onClose,
  onDone,
}: {
  alert: ScreeningAlert | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [decision, setDecision] = useState("clear_false_positive");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const privileged = canDecide(user?.role);

  useEffect(() => {
    if (alert) {
      setDecision("clear_false_positive");
      setNotes("");
    }
  }, [alert]);

  if (!alert) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api<{ case_no?: string }>(`/alerts/${alert.id}/decision`, {
        method: "PUT",
        body: { decision, notes: notes || undefined },
      });
      if (decision === "escalate") {
        toast(`Alert escalated. Investigation case ${res?.case_no ? res.case_no + " " : ""}opened.`);
      } else if (decision === "confirm_match") {
        toast("Match confirmed. The customer has been restricted.", "info");
      } else {
        toast("Alert cleared as a false positive.");
      }
      onDone();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the decision.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!alert}
      onClose={onClose}
      title="Decide screening alert"
      sub={`${alert.matched_name} · ${alert.match_score}% match · ${alert.list_name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Save decision"}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <Pill tone={priorityTone(alert.priority)}>{humanize(alert.priority)} priority</Pill>
        <Pill tone="slate">{humanize(alert.status)}</Pill>
        {alert.customer && (
          <span className="text-[12.5px] text-slate-500">
            Customer: <span className="font-medium text-ink">{alert.customer.full_name}</span>
          </span>
        )}
      </div>
      <div className="space-y-4">
        <Field label="Decision" required>
          <Select value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="clear_false_positive">Clear — false positive (same name, different person)</option>
            <option value="escalate">Escalate — open an investigation case</option>
            <option value="confirm_match" disabled={!privileged}>
              Confirm true match — restrict the customer{privileged ? "" : " (MLRO / owner only)"}
            </option>
          </Select>
        </Field>
        <Field
          label="Decision notes"
          hint="Record the identifiers you compared (date of birth, nationality, ID number). This note is part of the audit trail."
        >
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Date of birth and nationality differ from the listed person; Emirates ID verified."
          />
        </Field>
        {decision === "confirm_match" && (
          <p className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-danger">
            Confirming a true match restricts the customer immediately and blocks further transactions
            pending the MLRO's STR decision.
          </p>
        )}
      </div>
    </Modal>
  );
}

export function TmAlertDecisionModal({
  alert,
  onClose,
  onDone,
}: {
  alert: TmAlert | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [decision, setDecision] = useState("close_benign");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (alert) {
      setDecision("close_benign");
      setNotes("");
    }
  }, [alert]);

  if (!alert) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/tm-alerts/${alert.id}/decision`, {
        method: "PUT",
        body: { decision, notes: notes || undefined },
      });
      toast(
        decision === "escalate"
          ? "Alert escalated. An investigation case has been opened."
          : "Alert closed as benign."
      );
      onDone();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the decision.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!alert}
      onClose={onClose}
      title="Decide transaction alert"
      sub={alert.title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Save decision"}
          </Button>
        </>
      }
    >
      {alert.description && (
        <p className="mb-4 rounded-lg bg-page px-3.5 py-2.5 text-[12.5px] leading-relaxed text-slate-600">
          {alert.description}
        </p>
      )}
      <div className="space-y-4">
        <Field label="Decision" required>
          <Select value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="close_benign">Close — activity is benign and explained</option>
            <option value="escalate">Escalate — open an investigation case</option>
          </Select>
        </Field>
        <Field label="Notes" hint="Explain the customer's stated purpose and any documents you relied on.">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Customer provided supplier invoices covering the cash purchases."
          />
        </Field>
      </div>
    </Modal>
  );
}
