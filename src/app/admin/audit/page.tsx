"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  actor_admin_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

const actionVariant: Record<string, "warning" | "info" | "default" | "success"> = {
  create: "success",
  update: "info",
  delete: "warning",
  status_change: "default",
  settings: "default",
};

const ENTITIES = ["car", "part", "order", "review", "faq", "post", "user", "settings"];
const ACTIONS = ["create", "update", "delete", "status_change", "settings"];

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (entity !== "all") params.set("entity", entity);
    if (action !== "all") params.set("action", action);
    fetch(`/api/admin/audit?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, entity, action]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Audit log</h1>
          <p className="text-muted-foreground">{total} recorded admin actions</p>
        </div>
        <Button variant="outline" onClick={fetchEntries}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={entity}
          onChange={(e) => { setPage(1); setEntity(e.target.value); }}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="all">All entities</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => { setPage(1); setAction(e.target.value); }}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="all">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Entries */}
      {loading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Loading...</CardContent></Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No audit entries.</p>
            <p className="text-sm mt-1">Privileged admin actions appear here as they happen.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground bg-muted/30">
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">When</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Actor</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Action</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Entity</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-border/60 last:border-0 align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono text-xs">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{e.actor_email || "—"}</span>
                      {e.ip && <span className="block text-xs text-muted-foreground">{e.ip}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={actionVariant[e.action] || "default"}>{e.action}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{e.entity}</span>
                      {e.entity_id && (
                        <span className="block text-xs text-muted-foreground font-mono truncate max-w-[160px]">
                          {e.entity_id}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[320px]">
                      {e.diff ? (
                        <code className="block text-xs text-muted-foreground whitespace-pre-wrap break-all">
                          {JSON.stringify(e.diff)}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
