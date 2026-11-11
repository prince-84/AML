"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api, apiList } from "@/lib/api";
import type { User } from "@/lib/types";
import { fmtDateTime, humanize, initials } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoading,
  Pill,
  Select,
  TableWrap,
  tdCls,
  thCls,
} from "@/components/ui";
import { IconPlus } from "@/components/icons";

const ROLE_INFO: Record<string, { label: string; tone: "navy" | "teal" | "amber" | "slate"; desc: string }> = {
  owner: { label: "Owner", tone: "navy", desc: "Full access, billing, and every approval right." },
  mlro: { label: "MLRO", tone: "teal", desc: "Compliance manager: decides alerts, approves KYC, files STRs." },
  officer: { label: "Officer", tone: "amber", desc: "Day-to-day onboarding, screening and first review of alerts." },
  viewer: { label: "Viewer", tone: "slate", desc: "Read-only access for auditors and management." },
};

export default function UsersSettingsPage() {
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "officer", phone: "" });

  const load = useCallback(async () => {
    try {
      setUsers(await apiList<User>("/settings/users"));
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", email: "", password: "", role: "officer", phone: "" });
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, phone: u.phone || "" });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || (!editing && !form.password)) {
      toast("Name, email and (for a new user) a password are required.", "error");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await api(`/settings/users/${editing.id}`, {
          method: "PUT",
          body: {
            name: form.name,
            role: form.role,
            phone: form.phone || null,
            ...(form.password ? { password: form.password } : {}),
          },
        });
        toast("User updated.");
      } else {
        await api("/settings/users", {
          method: "POST",
          body: { name: form.name, email: form.email, password: form.password, role: form.role, phone: form.phone || null },
        });
        toast("User added. They can sign in with the email and password you set.");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the user.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoading />;

  return (
    <div>
      <PageHeader
        title="Users & roles"
        sub="Who can sign in to this workspace and what they are allowed to do. Approval rights — deciding true matches, approving KYC and filing STRs — sit with the owner and the MLRO only."
        actions={
          <Button onClick={openNew}>
            <IconPlus className="h-4 w-4" /> Add user
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(ROLE_INFO).map(([key, info]) => (
          <Card key={key} className="p-4">
            <Pill tone={info.tone} dot={false}>
              {info.label}
            </Pill>
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">{info.desc}</p>
            <p className="mt-2 text-[12px] tabular-nums text-slate-400">
              {users.filter((u) => u.role === key).length} user{users.filter((u) => u.role === key).length === 1 ? "" : "s"}
            </p>
          </Card>
        ))}
      </div>

      <Card>
        {users.length === 0 ? (
          <EmptyState title="No users found" text="Add the first team member to this workspace." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={thCls}>User</th>
                  <th className={thCls}>Role</th>
                  <th className={thCls}>Phone</th>
                  <th className={thCls}>Last sign-in</th>
                  <th className={thCls}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className={tdCls}>
                      <span className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink font-display text-[11.5px] font-semibold text-white">
                          {initials(u.name)}
                        </span>
                        <span>
                          <span className="block font-medium text-ink">
                            {u.name}
                            {me?.id === u.id && <span className="ml-1.5 text-[11.5px] font-normal text-slate-400">(you)</span>}
                          </span>
                          <span className="block text-[12px] text-slate-400">{u.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className={tdCls}>
                      <Pill tone={(ROLE_INFO[u.role]?.tone as never) || "slate"} dot={false}>
                        {humanize(u.role)}
                      </Pill>
                    </td>
                    <td className={tdCls}>{u.phone || "—"}</td>
                    <td className={`${tdCls} tabular-nums text-slate-500`}>{u.last_login_at ? fmtDateTime(u.last_login_at) : "Never"}</td>
                    <td className={tdCls}>
                      <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit user" : "Add user"}
        sub={editing ? editing.email : "The new user signs in with these details."}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={submit}>
              {busy ? "Saving…" : editing ? "Save changes" : "Add user"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Sara Iqbal" />
          </Field>
          {!editing && (
            <Field label="Email" required>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@company.com" />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role" required>
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="owner">Owner</option>
                <option value="mlro">MLRO</option>
                <option value="officer">Officer</option>
                <option value="viewer">Viewer</option>
              </Select>
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+971 …" />
            </Field>
          </div>
          <Field label={editing ? "New password (leave blank to keep)" : "Password"} required={!editing}>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={editing ? "••••••••" : "Set an initial password"}
              autoComplete="new-password"
            />
          </Field>
          <p className="rounded-lg bg-page px-3.5 py-2.5 text-[12px] leading-relaxed text-slate-500">
            {ROLE_INFO[form.role]?.desc} Approval actions taken by any user are recorded in the audit
            trail under their name.
          </p>
        </div>
      </Modal>
    </div>
  );
}
