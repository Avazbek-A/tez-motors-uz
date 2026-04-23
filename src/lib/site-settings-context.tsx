"use client";

import { createContext, useContext } from "react";
import { mergeWithDefaults, type ResolvedSiteSettings } from "@/lib/site-settings";

const SiteSettingsContext = createContext<ResolvedSiteSettings>(mergeWithDefaults({}));

export function SiteSettingsProvider({
  value,
  children,
}: {
  value: ResolvedSiteSettings;
  children: React.ReactNode;
}) {
  return (
    <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>
  );
}

export function useSiteSettings(): ResolvedSiteSettings {
  return useContext(SiteSettingsContext);
}
