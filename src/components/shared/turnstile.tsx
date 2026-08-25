"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

/**
 * Cloudflare Turnstile widget for the public forms.
 *
 * Renders declaratively: the `cf-turnstile` class plus `data-*` attributes are
 * what api.js looks for, so Cloudflare mounts the widget itself and writes the
 * token into the `cf-turnstile-response` input it creates inside the container.
 * The previous version did its own explicit render from a useEffect and, in
 * production, never even appended the script — the container div was in the
 * form but no widget, no token, and (before the parameter fix) a thrown
 * TurnstileError. Declarative rendering removes that whole moving part; the
 * script tag is server-rendered by next/script, and the widget's presence is
 * visible in the HTML rather than dependent on an effect having run.
 *
 * The callback has to be reachable by name from api.js, so it goes on window
 * under a fixed key. Only renders when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 */
const CALLBACK = "__tezTurnstileToken";
const EXPIRED = "__tezTurnstileExpired";
const ERRORED = "__tezTurnstileError";

declare global {
  interface Window {
    [CALLBACK]?: (token: string) => void;
    [EXPIRED]?: () => void;
    [ERRORED]?: () => void;
  }
}

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    window[CALLBACK] = (token: string) => onTokenRef.current(token);
    window[EXPIRED] = () => onTokenRef.current(null);
    window[ERRORED] = () => onTokenRef.current(null);
    return () => {
      delete window[CALLBACK];
      delete window[EXPIRED];
      delete window[ERRORED];
    };
  }, []);

  if (!siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-callback={CALLBACK}
        data-expired-callback={EXPIRED}
        data-error-callback={ERRORED}
        data-appearance="interaction-only"
        data-theme="auto"
      />
    </>
  );
}
