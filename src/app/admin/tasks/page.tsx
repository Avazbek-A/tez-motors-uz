"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ListChecks, Loader2, Plus, Check, Clock, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Task {
  id: string;
  title: string;
  kind: string;
  customer_key: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  assigned_to: string | null;
  due_at: string | null;
  status: string;
  notes: string | null;
}

interface Assignee {
  id: string;
  email: string;
  name: string | null;
}

const KIND_TONE: Record<string, string> = {
  handoff: "text-[var(--warning)] border-[var(--warning)]",
  abandoned_deposit: "text-[var(--danger)] border-[var(--danger)]",
  stale_lead: "text-[var(--info)] border-[var(--info)]",
  follow_up: "text-[var(--info)] border-[var(--info)]",
  manual: "text-muted-foreground border-border",
};

const fmtDue = (s: string | null) => {
  if (!s) return null;
  try {
    return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  } catch {
    return s;
  }
};

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("open");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", customer_phone: "", customer_name: "", due_at: "", assigned_to: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback((st: string) => {
    setLoading(true);
    fetch(`/api/admin/tasks?status=${st}`)
      .then((r) => r.json())
      .then((d) => {
        setTasks(d.tasks || []);
        setAssignees(d.assignees || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(status);
  }, [status, load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/admin/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    load(status);
  };

  const complete = (id: string) => patch(id, { status: "done" });
  const snooze = (id: string) => patch(id, { status: "snoozed", due_at: new Date(Date.now() + 3 * 86_400_000).toISOString() });
  const reassign = (id: string, assigned_to: string) => patch(id, { assigned_to: assigned_to || null });

  const remove = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
    load(status);
  };

  const create = async () => {
    if (form.title.trim().length < 2) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          customer_phone: form.customer_phone || null,
          customer_name: form.customer_name || null,
          due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
          assigned_to: form.assigned_to || null,
        }),
      });
      if (res.ok) {
        setShowNew(false);
        setForm({ title: "", customer_phone: "", customer_name: "", due_at: "", assigned_to: "" });
        load(status);
      }
    } finally {
      setSaving(false);
    }
  };

  const assigneeName = (id: string | null) => {
    if (!id) return "Unassigned";
    const a = assignees.find((x) => x.id === id);
    return a ? a.name || a.email : "—";
  };
  const now = Date.now();

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <ListChecks className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
        </div>
        <Button size="sm" onClick={() => setShowNew((s) => !s)}><Plus className="w-4 h-4" /> New task</Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Your follow-up queue — auto-generated from stale leads, unpaid deposits and hot AI handoffs, plus
        anything you add. Overdue items are flagged.
      </p>

      <div className="flex gap-1 mb-4">
        {["open", "snoozed", "done", "all"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1 text-xs font-mono uppercase tracking-wider rounded-[2px] border ${status === s ? "border-[var(--accent)] text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {showNew && (
        <div className="bg-card border border-border p-4 mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">New task</h2>
            <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <Input placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Customer phone" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} className="text-sm" />
            <Input placeholder="Customer name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="text-sm" />
            <Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} className="text-sm" />
            <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="h-11 rounded-[2px] border border-border bg-[var(--bg-3)] px-2 text-sm text-foreground">
              <option value="">Unassigned</option>
              {assignees.map((a) => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
            </select>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={create} disabled={saving || form.title.trim().length < 2}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {status === "all" ? "" : status} tasks. 🎉</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const overdue = t.status === "open" && t.due_at && new Date(t.due_at).getTime() < now;
            return (
              <div key={t.id} className="bg-card border border-border p-3 flex items-start gap-3">
                {t.status !== "done" ? (
                  <button onClick={() => complete(t.id)} title="Mark done" className="mt-0.5 w-5 h-5 shrink-0 rounded-[2px] border border-border hover:border-[var(--success)] hover:text-[var(--success)] flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 opacity-0 hover:opacity-100" />
                  </button>
                ) : (
                  <span className="mt-0.5 w-5 h-5 shrink-0 rounded-[2px] bg-[var(--success)]/20 text-[var(--success)] flex items-center justify-center"><Check className="w-3.5 h-3.5" /></span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 border rounded-[2px] ${KIND_TONE[t.kind] || KIND_TONE.manual}`}>{t.kind.replace("_", " ")}</span>
                    <span className={`text-sm ${t.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {t.customer_key && <Link href={`/admin/customers`} className="hover:text-primary font-mono">{t.customer_phone}</Link>}
                    {t.due_at && <span className={overdue ? "text-[var(--danger)]" : ""}>due {fmtDue(t.due_at)}{overdue ? " · overdue" : ""}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    value={t.assigned_to || ""}
                    onChange={(e) => reassign(t.id, e.target.value)}
                    className="h-8 max-w-[120px] rounded-[2px] border border-border bg-[var(--bg-3)] px-1.5 text-xs text-foreground"
                    title="Assign"
                  >
                    <option value="">{assigneeName(null)}</option>
                    {assignees.map((a) => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
                  </select>
                  {t.status === "open" && (
                    <button onClick={() => snooze(t.id)} title="Snooze 3 days" className="text-muted-foreground hover:text-[var(--warning)] p-1"><Clock className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => remove(t.id)} title="Delete" className="text-muted-foreground hover:text-[var(--danger)] p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
