"use client";

import { useCallback, useEffect, useState } from "react";
import { Send, Loader2, Users2, Mail, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SegmentDef {
  key: string;
  label: string;
  description: string;
  channels: ("email" | "sms")[];
}

interface Detail {
  count: number;
  withEmail: number;
  withPhone: number;
  sample: { name: string | null; phone: string | null; email: string | null }[];
}

export default function AdminSegmentsPage() {
  const [segments, setSegments] = useState<SegmentDef[]>([]);
  const [selected, setSelected] = useState<SegmentDef | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [channel, setChannel] = useState<"email" | "sms">("sms");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/segments")
      .then((r) => r.json())
      .then((d) => setSegments(d.segments || []));
  }, []);

  const select = useCallback(async (def: SegmentDef) => {
    setSelected(def);
    setDetail(null);
    setResult(null);
    setChannel(def.channels[0]);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/segments?segment=${def.key}`);
      const d = await res.json();
      setDetail({ count: d.count, withEmail: d.withEmail, withPhone: d.withPhone, sample: d.sample || [] });
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const send = async () => {
    if (!selected || body.trim().length < 4) return;
    const reach = channel === "email" ? detail?.withEmail || 0 : detail?.withPhone || 0;
    if (!confirm(`Send this ${channel.toUpperCase()} to ${Math.min(reach, 300)} contacts in "${selected.label}"? This sends real messages.`)) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/segments/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: selected.key, channel, subject: subject || undefined, body }),
      });
      const d = await res.json();
      if (res.ok) {
        setResult(`Sent ${d.sent} / ${d.targeted}${d.failed ? `, ${d.failed} failed` : ""}${d.capped ? ` · ${d.capped} over the 300 cap not sent` : ""}.`);
        setBody("");
        setSubject("");
      } else {
        setResult(d.error || "Send failed.");
      }
    } finally {
      setSending(false);
    }
  };

  const reach = channel === "email" ? detail?.withEmail || 0 : detail?.withPhone || 0;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Send className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Campaigns</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Pick an audience, write a message, send by SMS or email. Use <code className="text-foreground">{"{name}"}</code> to
        personalize. Capped at 300 recipients per send.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Segment list */}
        <div className="space-y-2">
          {segments.map((s) => (
            <button
              key={s.key}
              onClick={() => select(s)}
              className={`w-full text-left bg-card border p-3 rounded-[2px] transition-colors ${selected?.key === s.key ? "border-[var(--accent)]" : "border-border hover:border-[var(--accent-line)]"}`}
            >
              <div className="flex items-center gap-2">
                <Users2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{s.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
            </button>
          ))}
        </div>

        {/* Compose */}
        <div>
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select an audience to compose a campaign.</p>
          ) : (
            <div className="bg-card border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{selected.label}</h2>
              {loadingDetail ? (
                <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /></div>
              ) : detail ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {detail.count} contacts · {detail.withPhone} reachable by SMS · {detail.withEmail} by email
                  </p>
                  <div className="flex gap-1">
                    {selected.channels.map((ch) => (
                      <button
                        key={ch}
                        onClick={() => setChannel(ch)}
                        className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-mono uppercase rounded-[2px] border ${channel === ch ? "border-[var(--accent)] text-primary" : "border-border text-muted-foreground"}`}
                      >
                        {ch === "email" ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />} {ch}
                      </button>
                    ))}
                  </div>
                  {channel === "email" && (
                    <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="text-sm" />
                  )}
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={channel === "sms" ? "Short SMS text. Hi {name}, …" : "Email body. Hi {name}, …"}
                    rows={channel === "sms" ? 3 : 6}
                    className="w-full rounded-[2px] border border-border bg-[var(--bg-3)] px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">→ {Math.min(reach, 300)} recipients</span>
                    <Button size="sm" onClick={send} disabled={sending || body.trim().length < 4 || reach === 0 || (channel === "email" && !subject)}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                    </Button>
                  </div>
                  {result && <p className="text-xs text-primary">{result}</p>}
                  {detail.sample.length > 0 && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Preview recipients ({detail.sample.length})</summary>
                      <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                        {detail.sample.map((c, i) => (
                          <div key={i} className="font-mono">{c.name || "—"} · {channel === "email" ? c.email || "(no email)" : c.phone || "(no phone)"}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
