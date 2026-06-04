"use client";

import { useEffect, useState } from "react";
import { Phone, Loader2, Plus } from "lucide-react";

interface Call {
  id: string;
  customer_phone: string | null;
  direction: string;
  duration_sec: number | null;
  summary: string | null;
  lead_score: number | null;
  created_at: string;
}

export default function AdminCallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [duration, setDuration] = useState("");
  const [transcript, setTranscript] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/calls");
      const data = await res.json();
      setCalls(data.calls || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function logCall() {
    if (!phone.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/admin/calls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer_phone: phone,
          direction,
          duration_sec: duration ? Number(duration) : null,
          transcript: transcript || null,
        }),
      });
      setPhone("");
      setDuration("");
      setTranscript("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Phone className="h-5 w-5 text-lime" />
        <h1 className="text-xl font-bold">Calls</h1>
      </div>

      <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap gap-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Customer phone" className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm" />
          <select value={direction} onChange={(e) => setDirection(e.target.value as "inbound" | "outbound")} className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm">
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration (sec)" inputMode="numeric" className="w-32 rounded border border-white/15 bg-black/20 px-3 py-2 text-sm" />
        </div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste transcript / notes (optional) — auto-summarized + scored"
          rows={3}
          className="w-full rounded border border-white/15 bg-black/20 px-3 py-2 text-sm"
        />
        <button onClick={logCall} disabled={saving || !phone.trim()} className="inline-flex items-center gap-1 rounded bg-lime px-3 py-2 text-sm font-medium text-navy disabled:opacity-50">
          <Plus className="h-4 w-4" /> {saving ? "Saving…" : "Log call"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : calls.length === 0 ? (
        <p className="text-white/50 text-sm">No calls logged yet.</p>
      ) : (
        <div className="space-y-2">
          {calls.map((c) => (
            <div key={c.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.customer_phone || "—"}</span>
                <span className="flex items-center gap-2 text-xs text-white/50">
                  <span className="uppercase">{c.direction}</span>
                  {c.duration_sec != null && <span>{Math.round(c.duration_sec / 60)}m</span>}
                  {c.lead_score != null && (
                    <span className={c.lead_score >= 60 ? "text-lime" : c.lead_score >= 30 ? "text-yellow-400" : "text-white/50"}>
                      score {c.lead_score}
                    </span>
                  )}
                </span>
              </div>
              {c.summary && <p className="mt-1 whitespace-pre-wrap text-white/70">{c.summary}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
