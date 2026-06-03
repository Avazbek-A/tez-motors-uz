"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, Circle, Settings, ShieldCheck, ShieldAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, type SetupSummary, type IntegrationCategory } from "@/lib/setup-status";

const ORDER: IntegrationCategory[] = ["core", "ai", "messaging", "payments", "marketing", "security"];

export default function AdminSetupPage() {
  const [data, setData] = useState<SetupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingLlm, setTestingLlm] = useState(false);
  const [llmResult, setLlmResult] = useState<{ ok: boolean; message?: string; provider?: string; model?: string; sample?: string; latencyMs?: number } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/setup-status")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const testLlm = async () => {
    setTestingLlm(true);
    setLlmResult(null);
    try {
      const r = await fetch("/api/admin/llm/test", { method: "POST" });
      setLlmResult(await r.json());
    } catch {
      setLlmResult({ ok: false, message: "Request failed." });
    } finally {
      setTestingLlm(false);
    }
  };

  const [testingNotify, setTestingNotify] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ telegram?: { configured: boolean; ok: boolean }; email?: { configured: boolean; ok: boolean } } | null>(null);
  const testNotify = async () => {
    setTestingNotify(true);
    setNotifyResult(null);
    try {
      const r = await fetch("/api/admin/notify/test", { method: "POST" });
      setNotifyResult(await r.json());
    } catch {
      setNotifyResult(null);
    } finally {
      setTestingNotify(false);
    }
  };
  const channelMsg = (c?: { configured: boolean; ok: boolean }) =>
    !c ? "" : c.ok ? "✓ sent — check your inbox/Telegram" : c.configured ? "✗ configured but send failed" : "not configured";

  const grouped = (cat: IntegrationCategory) => data?.integrations.filter((i) => i.category === cat) ?? [];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">Setup &amp; integrations</h1>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Everything here works out of the box and turns on extra power as you connect services.
        Nothing is required beyond the core — each switch below just unlocks more. Secrets are set as
        environment variables on your host; this page only shows whether each is connected (never the values).
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Could not load status.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 mb-6">
            <div className={`border p-3 rounded-[2px] ${data.coreReady ? "border-[var(--success)]/40" : "border-[var(--danger)]/40"}`}>
              <div className="flex items-center gap-2">
                {data.coreReady ? <ShieldCheck className="w-4 h-4 text-[var(--success)]" /> : <ShieldAlert className="w-4 h-4 text-[var(--danger)]" />}
                <p className="text-sm font-medium text-foreground">{data.coreReady ? "Core ready" : "Core incomplete"}</p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Database + admin login</p>
            </div>
            <div className="border border-border p-3 rounded-[2px]">
              <p className="font-mono text-lg font-semibold text-foreground">{data.activeOptional}/{data.totalOptional}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Optional integrations connected</p>
            </div>
          </div>

          {ORDER.map((cat) => {
            const items = grouped(cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="mb-5">
                <p className="px-1 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{CATEGORY_LABELS[cat]}</p>
                <div className="space-y-2">
                  {items.map((i) => (
                    <div key={i.key} className="bg-card border border-border p-3 flex items-start gap-3">
                      {i.active
                        ? <CheckCircle2 className="w-5 h-5 text-[var(--success)] shrink-0 mt-0.5" />
                        : <Circle className="w-5 h-5 text-muted-foreground/50 shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{i.label}</p>
                          {i.required && <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--danger)] border border-[var(--danger)]/40 rounded px-1">required</span>}
                          <span className={`text-[10px] font-mono uppercase ${i.active ? "text-[var(--success)]" : "text-muted-foreground"}`}>{i.active ? "connected" : "not set"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{i.unlocks}</p>
                        {!i.active && (
                          <p className="text-[11px] text-muted-foreground/80 mt-1">
                            Set: {i.missing.map((v) => <code key={v} className="text-foreground bg-[var(--bg-3)] px-1 rounded mr-1">{v}</code>)}
                          </p>
                        )}
                        {i.key === "llm" && (
                          <div className="mt-2">
                            <Button type="button" variant="outline" size="sm" onClick={testLlm} disabled={testingLlm}>
                              {testingLlm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Test connection
                            </Button>
                            {llmResult && (
                              <p className={`text-[11px] mt-1.5 ${llmResult.ok ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
                                {llmResult.ok
                                  ? `✓ ${llmResult.provider} · ${llmResult.model} · ${llmResult.latencyMs}ms — replied "${llmResult.sample}"`
                                  : `✗ ${llmResult.message || "no response"}`}
                              </p>
                            )}
                          </div>
                        )}
                        {(i.key === "telegram_alerts" || i.key === "email") && (
                          <div className="mt-2">
                            <Button type="button" variant="outline" size="sm" onClick={testNotify} disabled={testingNotify}>
                              {testingNotify ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Send test
                            </Button>
                            {notifyResult && (
                              <p className={`text-[11px] mt-1.5 ${(i.key === "telegram_alerts" ? notifyResult.telegram?.ok : notifyResult.email?.ok) ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
                                {channelMsg(i.key === "telegram_alerts" ? notifyResult.telegram : notifyResult.email)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
