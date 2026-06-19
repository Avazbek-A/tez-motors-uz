"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, Mic, MicOff, Delete, Loader2, Wifi, WifiOff } from "lucide-react";
import type { SimpleUser as SimpleUserType } from "sip.js/lib/platform/web";

/**
 * In-app WebRTC softphone (SIP.js) for the admin PWA. Registers to the self-hosted
 * Asterisk on the VPS over WSS and makes/receives real calls in the browser — calls
 * still pass the Asterisk dialplan's UZ-only outbound allowlist (toll-fraud cap).
 *
 * Config (WSS URL + SIP creds + ICE servers) comes from the admin-gated endpoint
 * /api/admin/calls/softphone-config, so the SIP password never ships in the bundle.
 * Until the PBX env is set the endpoint returns {configured:false} and this shows a
 * friendly "not set up yet" state — safe to ship before the VPS exists.
 *
 * Runtime is verified against the live PBX once it exists; the code path is guarded
 * so it can't crash the app before then.
 */
type Status = "loading" | "unconfigured" | "connecting" | "registered" | "incoming" | "outgoing" | "incall" | "error";

interface SoftphoneConfig {
  configured: boolean;
  wsServer?: string;
  sipUri?: string;
  authUser?: string;
  password?: string;
  displayName?: string;
  iceServers?: RTCIceServer[];
}

const STATUS_COPY: Record<Status, string> = {
  loading: "Загрузка…",
  unconfigured: "Софтфон ещё не настроен",
  connecting: "Подключение к АТС…",
  registered: "Готов к звонкам",
  incoming: "Входящий звонок",
  outgoing: "Вызов…",
  incall: "Идёт разговор",
  error: "Ошибка подключения",
};

export function Softphone() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string>("");
  const [number, setNumber] = useState("");
  const [muted, setMuted] = useState(false);
  const [peer, setPeer] = useState<string>("");

  const userRef = useRef<SimpleUserType | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const domainRef = useRef<string>("");

  // Connect + register once, using the admin-gated config.
  useEffect(() => {
    let cancelled = false;
    let su: SimpleUserType | null = null;

    (async () => {
      let cfg: SoftphoneConfig;
      try {
        cfg = await fetch("/api/admin/calls/softphone-config").then((r) => r.json());
      } catch {
        if (!cancelled) { setStatus("error"); setError("Не удалось получить настройки софтфона."); }
        return;
      }
      if (cancelled) return;
      if (!cfg.configured || !cfg.wsServer || !cfg.sipUri || !audioRef.current) {
        setStatus("unconfigured");
        return;
      }
      domainRef.current = cfg.sipUri.split("@")[1] || "";

      // Dynamic import keeps sip.js out of SSR + the initial bundle.
      const { SimpleUser } = await import("sip.js/lib/platform/web");
      if (cancelled) return;

      su = new SimpleUser(cfg.wsServer, {
        aor: cfg.sipUri,
        media: { remote: { audio: audioRef.current }, constraints: { audio: true, video: false } },
        userAgentOptions: {
          authorizationUsername: cfg.authUser,
          authorizationPassword: cfg.password,
          displayName: cfg.displayName,
          sessionDescriptionHandlerFactoryOptions: {
            peerConnectionConfiguration: { iceServers: cfg.iceServers || [] },
          },
        },
        delegate: {
          onCallReceived: async () => {
            setStatus("incoming");
            setPeer("");
          },
          onCallAnswered: () => setStatus("incall"),
          onCallHangup: () => { setStatus("registered"); setPeer(""); setMuted(false); },
          onServerDisconnect: () => { if (!cancelled) setStatus("error"); },
        },
      });
      userRef.current = su;

      try {
        setStatus("connecting");
        await su.connect();
        await su.register();
        if (!cancelled) setStatus("registered");
      } catch (e) {
        if (!cancelled) { setStatus("error"); setError((e as Error)?.message || "registration failed"); }
      }
    })();

    return () => {
      cancelled = true;
      const u = su || userRef.current;
      if (u) {
        u.unregister().catch(() => {});
        u.disconnect().catch(() => {});
      }
      userRef.current = null;
    };
  }, []);

  const dial = useCallback(async () => {
    const u = userRef.current;
    const digits = number.replace(/\D/g, "");
    if (!u || !digits || !domainRef.current) return;
    try {
      setStatus("outgoing");
      setPeer(digits);
      await u.call(`sip:${digits}@${domainRef.current}`);
    } catch (e) {
      setStatus("registered");
      setError((e as Error)?.message || "call failed");
    }
  }, [number]);

  const answer = useCallback(async () => { await userRef.current?.answer().catch(() => {}); }, []);
  const hangup = useCallback(async () => {
    const u = userRef.current;
    if (!u) return;
    // hangup() ends an active/outgoing call; decline() rejects a ringing inbound.
    if (status === "incoming") await u.decline().catch(() => {});
    else await u.hangup().catch(() => {});
    setStatus("registered"); setPeer(""); setMuted(false);
  }, [status]);

  const toggleMute = useCallback(() => {
    const u = userRef.current;
    if (!u) return;
    if (muted) { u.unmute(); setMuted(false); } else { u.mute(); setMuted(true); }
  }, [muted]);

  const inCall = status === "incall" || status === "outgoing" || status === "incoming";
  const online = status === "registered" || inCall;

  return (
    <div className="max-w-sm mx-auto bg-card border border-border rounded-2xl p-5 space-y-4">
      <audio ref={audioRef} autoPlay hidden />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Софтфон</h2>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${online ? "text-[var(--success,#16a34a)]" : status === "error" ? "text-[var(--danger,#ef4444)]" : "text-muted-foreground"}`}>
          {status === "loading" || status === "connecting" ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {STATUS_COPY[status]}
        </span>
      </div>

      {status === "unconfigured" && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Софтфон включится, когда заработает АТС (Asterisk на VPS) и в окружении приложения
          будут заданы <code className="text-[10px]">PBX_WS_URL</code> и данные SIP-аккаунта.
          См. <code className="text-[10px]">deploy/asterisk/README.md</code>.
        </p>
      )}

      {status === "error" && (
        <p className="text-xs text-[var(--danger,#ef4444)] leading-relaxed break-words">{error || "Ошибка подключения к АТС."}</p>
      )}

      {(online || status === "connecting") && (
        <>
          {peer && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-foreground">
              {status === "incoming" ? <PhoneIncoming className="w-4 h-4 text-[var(--success,#16a34a)] animate-pulse" />
                : <PhoneOutgoing className="w-4 h-4 text-primary" />}
              <span className="font-mono">{peer}</span>
            </div>
          )}

          {!inCall && (
            <input
              type="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="998 90 123 45 67"
              className="w-full text-center text-lg font-mono bg-muted border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}

          {!inCall && (
            <div className="grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9","*","0","#"].map((k) => (
                <button key={k} type="button" onClick={() => setNumber((n) => n + k)}
                  className="py-2.5 rounded-lg bg-muted hover:bg-muted/70 text-foreground font-medium transition-colors">
                  {k}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-1">
            {status === "incoming" && (
              <button type="button" onClick={answer} title="Ответить"
                className="w-12 h-12 rounded-full bg-[var(--success,#16a34a)] text-white flex items-center justify-center hover:opacity-90">
                <Phone className="w-5 h-5" />
              </button>
            )}
            {status === "registered" && (
              <>
                <button type="button" onClick={() => setNumber((n) => n.slice(0, -1))} title="Стереть"
                  className="w-12 h-12 rounded-full bg-muted text-foreground flex items-center justify-center hover:bg-muted/70">
                  <Delete className="w-5 h-5" />
                </button>
                <button type="button" onClick={dial} disabled={!number.replace(/\D/g, "")} title="Позвонить"
                  className="w-14 h-14 rounded-full bg-[var(--success,#16a34a)] text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40">
                  <Phone className="w-6 h-6" />
                </button>
              </>
            )}
            {inCall && (
              <>
                {status === "incall" && (
                  <button type="button" onClick={toggleMute} title={muted ? "Включить микрофон" : "Выключить микрофон"}
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${muted ? "bg-[var(--warning,#d97706)] text-white" : "bg-muted text-foreground hover:bg-muted/70"}`}>
                    {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                )}
                <button type="button" onClick={hangup} title={status === "incoming" ? "Отклонить" : "Завершить"}
                  className="w-14 h-14 rounded-full bg-[var(--danger,#ef4444)] text-white flex items-center justify-center hover:opacity-90">
                  <PhoneOff className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
