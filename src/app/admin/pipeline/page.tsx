"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw, Phone, Mail, Clock, ArrowRight, CheckCircle, GripVertical, AlertCircle, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Inquiry pipeline kanban (Phase Y1).
 *
 * Four columns mirror the inquiry status machine (new → contacted → in_progress
 * → closed). Cards are draggable between columns; a drop PATCHes the inquiry via
 * PUT /api/inquiry/[id], preserving the other mutable fields (notes,
 * follow_up_date, assigned_to) so the kanban never clobbers CRM data set on the
 * inquiries page. Optional filter by assigned salesperson.
 */

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  message?: string | null;
  type: string;
  status: string;
  source_page?: string | null;
  car_id?: string | null;
  created_at: string;
  notes?: string | null;
  follow_up_date?: string | null;
  assigned_to?: string | null;
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
}

const COLUMNS = [
  { key: "new", label: "New", icon: Clock, accent: "border-t-blue-500" },
  { key: "contacted", label: "Contacted", icon: Phone, accent: "border-t-yellow-500" },
  { key: "in_progress", label: "In Progress", icon: ArrowRight, accent: "border-t-purple-500" },
  { key: "closed", label: "Closed", icon: CheckCircle, accent: "border-t-green-500" },
] as const;

const typeLabels: Record<string, string> = {
  general: "General",
  car_inquiry: "Car Inquiry",
  callback: "Callback",
  calculator: "Calculator",
  reservation: "Reservation",
  test_drive: "Test Drive",
  trade_in: "Trade-in",
  newsletter: "Newsletter",
  price_drop: "Price Drop",
  service: "Service",
  part_inquiry: "Part Inquiry",
};

export default function AdminPipelinePage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [repFilter, setRepFilter] = useState<string>("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 2500);
  };

  const fetchInquiries = () => {
    setLoading(true);
    fetch("/api/inquiry")
      .then((r) => r.json())
      .then((data) => setInquiries(data.inquiries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInquiries();
    // Users are owner-only; a 403 just means we label by id and hide assignment.
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((data) => setUsers(data.users || []))
      .catch(() => {});
  }, []);

  const emailById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.id, u.email);
    return m;
  }, [users]);

  const repLabel = (id?: string | null) => {
    if (!id) return "Unassigned";
    return emailById.get(id) || `${id.slice(0, 8)}…`;
  };

  // Distinct assignees present in the data (for the filter), even when the
  // users list is unavailable.
  const repOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const i of inquiries) if (i.assigned_to) ids.add(i.assigned_to);
    return Array.from(ids);
  }, [inquiries]);

  const visible = useMemo(() => {
    if (repFilter === "all") return inquiries;
    if (repFilter === "__unassigned__") return inquiries.filter((i) => !i.assigned_to);
    return inquiries.filter((i) => i.assigned_to === repFilter);
  }, [inquiries, repFilter]);

  const moveTo = async (inquiry: Inquiry, status: string) => {
    if (inquiry.status === status) return;
    const prev = inquiry.status;
    // Optimistic update.
    setInquiries((list) => list.map((i) => (i.id === inquiry.id ? { ...i, status } : i)));
    const res = await fetch(`/api/inquiry/${inquiry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        notes: inquiry.notes ?? null,
        follow_up_date: inquiry.follow_up_date ?? null,
        assigned_to: inquiry.assigned_to ?? null,
      }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setInquiries((list) => list.map((i) => (i.id === inquiry.id ? { ...i, status: prev } : i)));
      showFeedback("error", "Failed to move card");
    } else {
      showFeedback("success", `Moved to ${COLUMNS.find((c) => c.key === status)?.label}`);
    }
  };

  const onDrop = (status: string) => {
    setDragOverCol(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const inquiry = inquiries.find((i) => i.id === id);
    if (inquiry) moveTo(inquiry, status);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-muted-foreground text-sm">Drag inquiries between stages.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">All salespeople</option>
            <option value="__unassigned__">Unassigned</option>
            {repOptions.map((id) => (
              <option key={id} value={id}>{repLabel(id)}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={fetchInquiries} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {feedback && (
        <div className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium",
          feedback.type === "success"
            ? "bg-green-500/10 border border-green-500/20 text-green-400"
            : "bg-red-500/10 border border-red-500/20 text-red-400",
        )}>
          {feedback.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const cards = visible.filter((i) => i.status === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
              onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
              onDrop={() => onDrop(col.key)}
              className={cn(
                "rounded-2xl border bg-white/[0.02] border-t-4 p-3 min-h-[200px] transition-colors",
                col.accent,
                dragOverCol === col.key ? "border-lime bg-lime/5" : "border-white/10",
              )}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <col.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">{col.label}</span>
                </div>
                <Badge variant="secondary">{cards.length}</Badge>
              </div>

              <div className="space-y-2">
                {cards.map((inq) => (
                  <div
                    key={inq.id}
                    draggable
                    onDragStart={() => setDragId(inq.id)}
                    onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                    className={cn(
                      "group rounded-xl border border-white/10 bg-card p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md",
                      dragId === inq.id && "opacity-50",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-white/20 mt-0.5 shrink-0 group-hover:text-white/40" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm truncate">{inq.name}</p>
                          <Badge variant="secondary" className="text-[10px]">{typeLabels[inq.type] || inq.type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{inq.phone}</p>
                        {inq.message && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{inq.message}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {repLabel(inq.assigned_to)}
                          </span>
                          {inq.follow_up_date && (
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {inq.follow_up_date}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <a
                            href={`tel:${inq.phone}`}
                            className="inline-flex items-center gap-1 text-[11px] text-lime hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="w-3 h-3" /> Call
                          </a>
                          {inq.email && (
                            <a
                              href={`mailto:${inq.email}`}
                              className="inline-flex items-center gap-1 text-[11px] text-lime hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="w-3 h-3" /> Email
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {cards.length === 0 && !loading && (
                  <p className="text-xs text-muted-foreground text-center py-6">No inquiries</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
