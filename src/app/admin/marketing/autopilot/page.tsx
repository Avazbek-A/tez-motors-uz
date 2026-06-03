"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, Wand2, Check, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contentKindLabel } from "@/lib/marketing-content";

interface Suggestion {
  key: string;
  priority: number;
  reason: string;
  kind: string;
  locale: string;
  carId: string | null;
  topic: string | null;
  subjectLabel: string;
  tone: string;
}

const LOCALES = [{ k: "ru", l: "RU" }, { k: "uz", l: "UZ" }, { k: "en", l: "EN" }];

export default function MarketingAutopilotPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [locales, setLocales] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/marketing/suggestions")
      .then((r) => r.json())
      .then((d) => setSuggestions(d.suggestions || []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const draftIt = async (s: Suggestion) => {
    setBusyKey(s.key); setNote(null);
    try {
      const res = await fetch("/api/admin/marketing/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: s.kind,
          locale: locales[s.key] || s.locale,
          car_id: s.carId,
          topic: s.topic,
          tone: s.tone,
          subject: s.subjectLabel,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setDone((prev) => ({ ...prev, [s.key]: true }));
        setNote(d.ai ? "Draft created with AI — review it in the library." : "Draft created from a template (set LLM_API_KEY for AI copy).");
      } else {
        setNote(d.error || "Could not create the draft.");
      }
    } catch {
      setNote("Could not create the draft.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="max-w-4xl">
      <Link href="/admin/marketing" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-3">
        <ArrowLeft className="w-3.5 h-3.5" /> Content Studio
      </Link>
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">Marketing Autopilot</h1>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        What&apos;s worth posting right now — derived from your live inventory: stock that&apos;s sitting too long,
        fresh arrivals, models people keep asking about, and promos already running. One click drafts the copy
        into your Content Studio library, ready to review and schedule.
      </p>

      {note && <p className="text-xs text-primary mb-4">{note}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Reading the business…</div>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No suggestions right now — add inventory or check back later.</p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => (
            <div key={s.key} className="bg-card border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs mb-1">
                  <span className="font-mono uppercase text-[var(--accent)]">{contentKindLabel(s.kind)}</span>
                  <span className="text-foreground font-medium truncate">{s.subjectLabel}</span>
                </div>
                <p className="text-sm text-muted-foreground">{s.reason}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={locales[s.key] || s.locale}
                  onChange={(e) => setLocales((prev) => ({ ...prev, [s.key]: e.target.value }))}
                  className="h-9 rounded-[2px] border border-border bg-[var(--bg-3)] px-2 text-xs text-foreground"
                  aria-label="Language"
                >
                  {LOCALES.map((l) => <option key={l.k} value={l.k}>{l.l}</option>)}
                </select>
                {done[s.key] ? (
                  <Button type="button" variant="outline" size="sm" disabled><Check className="w-4 h-4" /> Drafted</Button>
                ) : (
                  <Button type="button" size="sm" onClick={() => draftIt(s)} disabled={busyKey === s.key}>
                    {busyKey === s.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wand2 className="w-4 h-4" /> Draft it</>}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-6">
        Drafts land in the <Link href="/admin/marketing" className="text-primary hover:underline">Content Studio</Link> library.
        Edit, then post now or schedule — nothing publishes automatically.
      </p>
    </div>
  );
}
