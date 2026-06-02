"use client";

import { useEffect, useState } from "react";
import { Megaphone, Loader2, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminBroadcastPage() {
  const [subscribers, setSubscribers] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ recipients: number; sent: number } | null>(null);

  useEffect(() => {
    fetch("/api/admin/broadcast")
      .then((r) => r.json())
      .then((d) => setSubscribers(typeof d.subscribers === "number" ? d.subscribers : 0))
      .catch(() => setSubscribers(0));
  }, []);

  const send = async () => {
    if (!subject.trim() || !message.trim()) return;
    if (!confirm(`Send "${subject}" to ${subscribers ?? 0} subscribers?`)) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({ recipients: data.recipients ?? 0, sent: data.sent ?? 0 });
        setSubject("");
        setMessage("");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <Megaphone className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Broadcast</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Email an announcement to your newsletter subscribers
        {subscribers != null && <> — <span className="font-mono text-foreground">{subscribers}</span> on the list</>}.
      </p>

      {result && (
        <div className="mb-6 flex items-center gap-2 bg-[var(--accent-tint)] border border-[var(--accent-line)] px-4 py-3 text-sm text-primary">
          <CheckCircle className="w-4 h-4" /> Sent to {result.sent} of {result.recipients} subscribers.
        </div>
      )}

      <div className="bg-card border border-border p-5 space-y-4">
        <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea
          placeholder="Message (plain text — line breaks preserved)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={8}
          className="w-full rounded-[2px] border border-border bg-[var(--bg-3)] px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--accent)] resize-none"
        />
        <Button onClick={send} disabled={sending || !subject.trim() || !message.trim()}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Megaphone className="w-4 h-4" /> Send broadcast</>}
        </Button>
      </div>
    </div>
  );
}
