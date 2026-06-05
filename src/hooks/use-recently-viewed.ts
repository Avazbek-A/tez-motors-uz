"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "tez-motors-recently-viewed";
const MAX_ITEMS = 6;

export function useRecentlyViewed() {
  const [viewedIds, setViewedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setViewedIds(JSON.parse(stored));
    } catch {}
  }, []);

  const addViewed = useCallback((carId: string) => {
    setViewedIds((prev) => {
      const filtered = prev.filter((id) => id !== carId);
      const updated = [carId, ...filtered].slice(0, MAX_ITEMS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    // Behavioral event beacon (Phase AW Leap 2) — the server attaches the contact
    // when a customer session exists, so browsed-no-inquiry journeys can reach
    // them. Fire-and-forget; never blocks the UI.
    if (/^[a-f0-9-]{8,}$/i.test(carId)) {
      try {
        const body = JSON.stringify({ type: "car_view", car_id: carId });
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
        } else {
          fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  const clearViewed = useCallback(() => {
    setViewedIds([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return { viewedIds, addViewed, clearViewed };
}
