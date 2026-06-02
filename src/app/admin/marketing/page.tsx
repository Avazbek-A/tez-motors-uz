"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Loader2, Sparkles, Copy, Send, Save, Trash2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CONTENT_KINDS, contentKindLabel } from "@/lib/marketing-content";

interface Car { id: string; brand: string; model: string; year: number | null }
interface Draft { id: string; kind: string; locale: string; subject: string | null; body: string; status: string; created_at: string }

const LOCALES = [{ k: "ru", l: "RU" }, { k: "uz", l: "UZ" }, { k: "en", l: "EN" }];
const SOCIAL = new Set(["telegram", "instagram", "facebook", "promo", "ad"]);

export default function AdminMarketingPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [mode, setMode] = useState<"car" | "topic">("car");
  const [carId, setCarId] = useState("");
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState("telegram");
  const [locale, setLocale] = useState("ru");
  const [tone, setTone] = useState("");
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadDrafts = useCallback(() => {
    fetch("/api/admin/marketing/drafts").then((r) => r.json()).then((d) => setDrafts(d.drafts || []));
  }, []);
  useEffect(() => {
    fetch("/api/cars?all=true&limit=200").then((r) => r.json()).then((d) => setCars(d.cars || [])).catch(() => {});
    loadDrafts();
  }, [loadDrafts]);

  const generate = async () => {
    if (mode === "car" && !carId) { setNote("Pick a car first."); return; }
    if (mode === "topic" && topic.trim().length < 3) { setNote("Enter a topic first."); return; }
    setGenerating(true); setNote(null);
    try {
      const res = await fetch("/api/admin/marketing/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, locale, car_id: mode === "car" ? carId : null, topic: mode === "topic" ? topic.trim() : null, tone: tone || null }),
      });
      const d = await res.json();
      if (d.text) { setText(d.text); if (!d.ai) setNote("Generated from a template (set LLM_API_KEY for AI copy)."); }
      else setNote(d.error || "Generation failed.");
    } finally { setGenerating(false); }
  };

  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };

  const subjectLabel = () => {
    if (mode === "car") { const c = cars.find((x) => x.id === carId); return c ? `${c.brand} ${c.model}${c.year ? ` ${c.year}` : ""}` : null; }
    return topic.trim() || null;
  };

  const save = async () => {
    if (!text.trim()) return;
    setBusy(true); setNote(null);
    try {
      const res = await fetch("/api/admin/marketing/drafts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, locale, subject: subjectLabel(), car_id: mode === "car" ? carId || null : null, body: text }),
      });
      if (res.ok) { setNote("Saved to library."); loadDrafts(); }
    } finally { setBusy(false); }
  };

  const publish = async () => {
    if (!text.trim()) return;
    setBusy(true); setNote(null);
    try {
      const res = await fetch("/api/admin/marketing/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const d = await res.json();
      setNote(d.ok ? "Posted to your Telegram channel." : d.reason || "Could not post.");
      if (d.ok) loadDrafts();
    } finally { setBusy(false); }
  };

  const delDraft = async (id: string) => { await fetch(`/api/admin/marketing/drafts?id=${id}`, { method: "DELETE" }); loadDrafts(); };
  const applyDraft = (d: Draft) => { setText(d.body); setKind(d.kind); setLocale(d.locale); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Megaphone className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Content Studio</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        AI-drafted marketing — social posts, ad copy, blog articles and promos, grounded on your real
        inventory, in RU / UZ / EN. Generate, edit, post to your Telegram channel, or save to the library.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Composer */}
        <div className="bg-card border border-border p-4 space-y-3">
          <div className="flex gap-1">
            {(["car", "topic"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 text-xs font-mono uppercase rounded-[2px] border ${mode === m ? "border-[var(--accent)] text-primary" : "border-border text-muted-foreground"}`}>{m === "car" ? "From a car" : "Topic"}</button>
            ))}
          </div>
          {mode === "car" ? (
            <select value={carId} onChange={(e) => setCarId(e.target.value)} className="w-full h-11 rounded-[2px] border border-border bg-[var(--bg-3)] px-3 text-sm text-foreground">
              <option value="">Select a car…</option>
              {cars.map((c) => <option key={c.id} value={c.id}>{c.brand} {c.model}{c.year ? ` ${c.year}` : ""}</option>)}
            </select>
          ) : (
            <Input placeholder="Topic, e.g. 'customs clearance in Uzbekistan 2026'" value={topic} onChange={(e) => setTopic(e.target.value)} className="text-sm" />
          )}
          <div className="grid grid-cols-3 gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-10 rounded-[2px] border border-border bg-[var(--bg-3)] px-2 text-sm text-foreground col-span-2">
              {CONTENT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
            <select value={locale} onChange={(e) => setLocale(e.target.value)} className="h-10 rounded-[2px] border border-border bg-[var(--bg-3)] px-2 text-sm text-foreground">
              {LOCALES.map((l) => <option key={l.k} value={l.k}>{l.l}</option>)}
            </select>
          </div>
          <Input placeholder="Tone (optional): excited, premium, concise…" value={tone} onChange={(e) => setTone(e.target.value)} className="text-sm" />
          <Button type="button" onClick={generate} disabled={generating} className="w-full">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Generate</>}
          </Button>
        </div>

        {/* Output */}
        <div className="bg-card border border-border p-4 space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Generated content appears here — edit freely." rows={12}
            className="w-full rounded-[2px] border border-border bg-[var(--bg-3)] px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--accent)] whitespace-pre-wrap" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copy} disabled={!text.trim()}>{copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}</Button>
            <Button type="button" variant="outline" size="sm" onClick={save} disabled={busy || !text.trim()}><Save className="w-4 h-4" /> Save</Button>
            {SOCIAL.has(kind) && (
              <Button type="button" size="sm" onClick={publish} disabled={busy || !text.trim()}><Send className="w-4 h-4" /> Post to Telegram</Button>
            )}
          </div>
          {note && <p className="text-xs text-primary">{note}</p>}
        </div>
      </div>

      {/* Library */}
      <h2 className="text-sm font-semibold text-foreground mt-8 mb-2">Content library</h2>
      {drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing saved yet.</p>
      ) : (
        <div className="space-y-2">
          {drafts.map((d) => (
            <div key={d.id} className="bg-card border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono uppercase text-muted-foreground">{contentKindLabel(d.kind)} · {d.locale}</span>
                  {d.subject && <span className="text-foreground truncate">{d.subject}</span>}
                  {d.status === "published" && <span className="text-[10px] font-mono uppercase text-[var(--success)]">published</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => applyDraft(d)} className="text-xs text-primary hover:underline">Use</button>
                  <button onClick={() => delDraft(d.id)} className="text-muted-foreground hover:text-[var(--danger)] p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{d.body.slice(0, 200)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
