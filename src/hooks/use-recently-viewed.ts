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
  }, []);

  const clearViewed = useCallback(() => {
    setViewedIds([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return { viewedIds, addViewed, clearViewed };
}
