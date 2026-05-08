"use client";

import { useEffect, useState } from "react";

/**
 * Tawk.to live chat widget.
 *
 * - Defers loading until the user first interacts (scroll / click /
 *   touch / keypress) OR 6 s of idle time, whichever comes first.
 *   Tawk pulls a ~120 kB bundle that otherwise tanks mobile TBT and
 *   delays interactivity for visitors who never open the chat.
 * - Fails open if the script is blocked by an ad blocker.
 */
export function TawkChat() {
  const id = process.env.NEXT_PUBLIC_TAWK_ID;
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!id || shouldLoad) return;

    let timeoutId: number | undefined;
    let armed = true;

    const trigger = () => {
      if (!armed) return;
      armed = false;
      setShouldLoad(true);
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener("scroll", trigger);
      window.removeEventListener("click", trigger);
      window.removeEventListener("touchstart", trigger);
      window.removeEventListener("keydown", trigger);
      window.removeEventListener("mousemove", trigger);
      if (timeoutId) window.clearTimeout(timeoutId);
    };

    window.addEventListener("scroll", trigger, { passive: true, once: true });
    window.addEventListener("click", trigger, { once: true });
    window.addEventListener("touchstart", trigger, { passive: true, once: true });
    window.addEventListener("keydown", trigger, { once: true });
    window.addEventListener("mousemove", trigger, { passive: true, once: true });
    timeoutId = window.setTimeout(trigger, 6000);

    return cleanup;
  }, [id, shouldLoad]);

  useEffect(() => {
    if (!id || !shouldLoad) return;
    if (document.getElementById("tawk-loader-script")) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tawk_API = (window as any).Tawk_API || {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tawk_LoadStart = new Date();
      const s = document.createElement("script");
      s.id = "tawk-loader-script";
      s.async = true;
      s.src = `https://embed.tawk.to/${id}`;
      s.charset = "UTF-8";
      s.setAttribute("crossorigin", "*");
      document.body.appendChild(s);
    } catch {
      // ad blocker or CSP; fail open.
    }
  }, [id, shouldLoad]);

  return null;
}
