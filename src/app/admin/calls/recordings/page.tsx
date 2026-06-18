"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Phone, Loader2, ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, Trash2, RefreshCw, Search } from "lucide-react";
import { AudioPlayer } from "@/components/admin/audio-player";

interface Recording {
  id: string;
  customer_phone: string | null;
  direction: string;
  duration_sec: number | null;
  summary: string | null;
  lead_score: number | null;
  transcript: string | null;
  recording_url: string | null;
  metadata: (Record<string, unknown> & { status?: string; language?: string; customer_name?: string }) | null;
  created_at: string;
}

const fmtDur = (s: number | null) => {
  if (!s || s < 0) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};
const fmtDate = (s: string) => { try { return new Date(s).toLocaleString("ru-RU"); } catch { return s; } };
const langLabel = (c?: string) => (!c ? "" : c === "ru" ? "RU" : c === "uz" ? "UZ" : c === "en" ? "EN" : c.toUpperCase());

export default function CallRecordingsPage() {
  const [rows, setRows] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.customer_phone, r.metadata?.customer_name, r.summary, r.transcript]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const load = useCallback(async () => {
    try {
      const d = await fetch("/api/admin/calls/upload-recording").then((r) => r.json());
      if (d.ok) setRows(d.recordings || []);
    } catch {
      /* keep prior rows */
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll while anything is still transcribing/analyzing (re-evaluates on every rows
  // change, so it also resumes after a manual re-analyze). Stops once all are done.
  useEffect(() => {
    const processing = rows.some((r) => r.metadata?.status && r.metadata.status !== "done" && r.metadata.status !== "error");
    if (!processing) return;
    const t = setTimeout(load, 5000);
    return () => clearTimeout(t);
  }, [rows, load]);

  const reprocess = async (id: string) => {
    try {
      await fetch(`/api/admin/calls/upload-recording?id=${encodeURIComponent(id)}`, { method: "PATCH" });
      // Optimistically mark processing → the poll effect resumes until it lands.
      setRows((rs) => rs.map((x) => (x.id === id ? { ...x, summary: null, metadata: { ...(x.metadata || {}), status: "transcribing" } } : x)));
    } catch {
      /* noop */
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить эту запись звонка? Действие необратимо.")) return;
    setDeleting((d) => ({ ...d, [id]: true }));
    try {
      const r = await fetch(`/api/admin/calls/upload-recording?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (r.ok) setRows((rs) => rs.filter((x) => x.id !== id));
    } catch {
      /* noop */
    } finally {
      setDeleting((d) => ({ ...d, [id]: false }));
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <Phone className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Записи звонков</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Записи, загруженные с телефона (нативная запись iOS / диктофон), через Telegram-бота или из
        админки. Каждая транскрибируется и анализируется ИИ, привязывается к клиенту.
      </p>

      {!loading && rows.length > 0 && (
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени, телефону, тексту…"
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Пока нет записей. Перешлите запись звонка боту @tezmotors_bot или загрузите из формы звонка.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ничего не найдено по запросу «{query}».</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {r.direction === "inbound"
                    ? <ArrowDownLeft className="w-4 h-4 text-[var(--success,#16a34a)] shrink-0" />
                    : <ArrowUpRight className="w-4 h-4 text-primary shrink-0" />}
                  <span className="font-medium text-foreground truncate">
                    {r.metadata?.customer_name || r.customer_phone || "—"}
                  </span>
                  {r.metadata?.customer_name && r.customer_phone && (
                    <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">{r.customer_phone}</span>
                  )}
                  <span className="text-[11px] text-muted-foreground shrink-0">{fmtDate(r.created_at)}</span>
                  {r.metadata?.language && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{langLabel(r.metadata.language)}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                  <span className="font-mono">{fmtDur(r.duration_sec)}</span>
                  {typeof r.lead_score === "number" && r.lead_score > 0 && (
                    <span className={`font-mono font-bold ${r.lead_score >= 60 ? "text-[var(--success,#16a34a)]" : r.lead_score >= 30 ? "text-[var(--warning,#d97706)]" : "text-muted-foreground"}`}>
                      {r.lead_score}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => reprocess(r.id)}
                    title="Переанализировать (новая модель/язык)"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={deleting[r.id]}
                    title="Удалить запись"
                    className="text-muted-foreground hover:text-[var(--danger,#ef4444)] transition-colors disabled:opacity-50"
                  >
                    {deleting[r.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {r.recording_url && <AudioPlayer src={r.recording_url} downloadName={`call-${r.customer_phone || r.id}`} />}

              {r.summary && <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{r.summary}</p>}

              {!r.summary && r.metadata?.status !== "done" && (
                <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {r.metadata?.status === "error"
                    ? "Не удалось расшифровать — запись сохранена, можно прослушать."
                    : "Расшифровка и анализ…"}
                </p>
              )}

              {r.transcript && (
                <div>
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {open[r.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    Транскрипт
                  </button>
                  {open[r.id] && (
                    <p className="mt-2 text-xs text-muted-foreground whitespace-pre-line leading-relaxed border-l-2 border-border pl-3">
                      {r.transcript}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
