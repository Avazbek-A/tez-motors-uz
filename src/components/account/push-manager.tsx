"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";

/**
 * Push subscription toggle for the account portal.
 *
 * Gated on NEXT_PUBLIC_VAPID_PUBLIC_KEY: when unset (push not configured) this
 * renders nothing, so the portal works without push. Fail-open: any registration
 * error just leaves the toggle in the off state.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushManager() {
  const { locale } = useLocale();
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => {});
  }, []);

  if (!vapidKey || !supported) return null;

  const t = (ru: string, uz: string, en: string) =>
    locale === "uz" ? uz : locale === "en" ? en : ru;

  const enable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setBusy(false);
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });
      const json = sub.toJSON();
      await fetch("/api/account/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          locale,
        }),
      });
      setSubscribed(true);
    } catch {
      // fail-open
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/account/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      // fail-open
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={subscribed ? disable : enable}
      disabled={busy}
      className="gap-2"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : subscribed ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {subscribed
        ? t("Отключить уведомления", "Bildirishnomalarni o'chirish", "Disable notifications")
        : t("Включить уведомления", "Bildirishnomalarni yoqish", "Enable notifications")}
    </Button>
  );
}
