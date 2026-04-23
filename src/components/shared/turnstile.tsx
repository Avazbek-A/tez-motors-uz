"use client";

import { useEffect, useRef } from "react";

/**
 * Invisible Cloudflare Turnstile widget.
 * Only renders when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; otherwise a no-op.
 */
type TurnstileWindow = Window & {
  turnstile?: {
    render: (el: HTMLElement, opts: Record<string, unknown>) => string;
    reset: (id?: string) => void;
    remove: (id: string) => void;
  };
};

declare global {
  interface Window {
    __ts_loaded?: boolean;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.__ts_loaded) return resolve();
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      window.__ts_loaded = true;
      return resolve();
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      window.__ts_loaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error("turnstile load failed"));
    document.head.appendChild(s);
  });
}

export function Turnstile({
  onToken,
}: {
  onToken: (token: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled) return;
        const ts = (window as TurnstileWindow).turnstile;
        if (!ts || !ref.current) return;
        widgetIdRef.current = ts.render(ref.current, {
          sitekey: siteKey,
          size: "invisible",
          callback: (token: string) => onToken(token),
          "error-callback": () => onToken(null),
          "expired-callback": () => onToken(null),
        });
      })
      .catch(() => {
        // Script blocked/failed — let the form submit without a token;
        // server is fail-open when secret is unset and will reject if the
        // secret is set but token is missing.
        onToken(null);
      });

    return () => {
      cancelled = true;
      const ts = (window as TurnstileWindow).turnstile;
      if (ts && widgetIdRef.current) {
        try {
          ts.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} />;
}
