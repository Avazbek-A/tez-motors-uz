"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";

const TOGGLE_THEME = { ru: "Сменить тему", uz: "Mavzuni almashtirish", en: "Toggle theme" } as const;

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { locale } = useLocale();
  // Derive the icon from the ACTUAL theme, not the CSS `.dark` class — the header
  // scopes itself to `.dark` over the hero, which would otherwise flip the icon.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-full w-9 h-9"
    >
      {isDark ? <Moon className="h-[1.2rem] w-[1.2rem]" /> : <Sun className="h-[1.2rem] w-[1.2rem]" />}
      <span className="sr-only">{TOGGLE_THEME[locale]}</span>
    </Button>
  );
}
