"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const COPY: Record<Locale, {
  title: string;
  recordedActions: (n: number) => string;
  refresh: string;
  allEntities: string;
  allActions: string;
  loading: string;
  noEntries: string;
  noEntriesHint: string;
  thWhen: string;
  thActor: string;
  thAction: string;
  thEntity: string;
  thDetails: string;
  prev: string;
  next: string;
  pageOf: (page: number, total: number) => string;
}> = {
  ru: {
    title: "Журнал аудита",
    recordedActions: (n) => `${n} записанных действий администратора`,
    refresh: "Обновить",
    allEntities: "Все сущности",
    allActions: "Все действия",
    loading: "Загрузка...",
    noEntries: "Нет записей аудита.",
    noEntriesHint: "Привилегированные действия администратора появляются здесь по мере их совершения.",
    thWhen: "Когда",
    thActor: "Кто",
    thAction: "Действие",
    thEntity: "Сущность",
    thDetails: "Детали",
    prev: "Назад",
    next: "Вперёд",
    pageOf: (page, total) => `Страница ${page} из ${total}`,
  },
  uz: {
    title: "Audit jurnali",
    recordedActions: (n) => `${n} ta yozilgan administrator amali`,
    refresh: "Yangilash",
    allEntities: "Barcha obyektlar",
    allActions: "Barcha amallar",
    loading: "Yuklanmoqda...",
    noEntries: "Audit yozuvlari yo'q.",
    noEntriesHint: "Imtiyozli administrator amallari sodir bo'lgani sayin shu yerda paydo bo'ladi.",
    thWhen: "Qachon",
    thActor: "Kim",
    thAction: "Amal",
    thEntity: "Obyekt",
    thDetails: "Tafsilotlar",
    prev: "Orqaga",
    next: "Oldinga",
    pageOf: (page, total) => `${page}-sahifa, jami ${total}`,
  },
  en: {
    title: "Audit log",
    recordedActions: (n) => `${n} recorded admin actions`,
    refresh: "Refresh",
    allEntities: "All entities",
    allActions: "All actions",
    loading: "Loading...",
    noEntries: "No audit entries.",
    noEntriesHint: "Privileged admin actions appear here as they happen.",
    thWhen: "When",
    thActor: "Actor",
    thAction: "Action",
    thEntity: "Entity",
    thDetails: "Details",
    prev: "Prev",
    next: "Next",
    pageOf: (page, total) => `Page ${page} of ${total}`,
  },
};

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
  const { locale } = useLocale();
  const t = COPY[locale];
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional on-mount sync (kick off a data load / read a browser-only value)
    fetchEntries();
  }, [fetchEntries]);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted-foreground">{t.recordedActions(total)}</p>
        </div>
        <Button variant="outline" onClick={fetchEntries}>
          <RefreshCw className="w-4 h-4" />
          {t.refresh}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={entity}
          onChange={(e) => { setPage(1); setEntity(e.target.value); }}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="all">{t.allEntities}</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => { setPage(1); setAction(e.target.value); }}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="all">{t.allActions}</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Entries */}
      {loading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">{t.loading}</CardContent></Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t.noEntries}</p>
            <p className="text-sm mt-1">{t.noEntriesHint}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground bg-muted/30">
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">{t.thWhen}</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">{t.thActor}</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">{t.thAction}</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">{t.thEntity}</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">{t.thDetails}</th>
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
            {t.prev}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t.pageOf(page, totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          >
            {t.next}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
