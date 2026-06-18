"use client";

import { useEffect, useState } from "react";
import { Phone, Loader2, ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
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
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const fmtDur = (s: number | null) => {
  if (!s || s < 0) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};
const fmtDate = (s: string) => { try { return new Date(s).toLocaleString("ru-RU"); } catch { return s; } };

export default function CallRecordingsPage() {
  const [rows, setRows] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/admin/calls/upload-recording")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setRows(d.recordings || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <Phone className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Записи звонков</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Записи, загруженные с телефона (нативная запись iOS / диктофон) или из админки. Каждая
        транскрибируется и анализируется ИИ, привязывается к клиенту.
      </p>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Пока нет записей. Загрузите запись звонка с телефона (через ярлык iOS) или из формы звонка.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {r.direction === "inbound"
                    ? <ArrowDownLeft className="w-4 h-4 text-[var(--success,#16a34a)] shrink-0" />
                    : <ArrowUpRight className="w-4 h-4 text-primary shrink-0" />}
                  <span className="font-medium text-foreground truncate">{r.customer_phone || "—"}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{fmtDate(r.created_at)}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                  <span className="font-mono">{fmtDur(r.duration_sec)}</span>
                  {typeof r.lead_score === "number" && (
                    <span className={`font-mono font-bold ${r.lead_score >= 60 ? "text-[var(--success,#16a34a)]" : r.lead_score >= 30 ? "text-[var(--warning,#d97706)]" : "text-muted-foreground"}`}>
                      {r.lead_score}
                    </span>
                  )}
                </div>
              </div>

              {r.recording_url && <AudioPlayer src={r.recording_url} downloadName={`call-${r.customer_phone || r.id}`} />}

              {r.summary && <p className="text-sm text-foreground leading-relaxed">{r.summary}</p>}

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
