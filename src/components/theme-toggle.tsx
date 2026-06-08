"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";

const TOGGLE_THEME = { ru: "Сменить тему", uz: "Mavzuni almashtirish", en: "Toggle theme" } as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { locale } = useLocale();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="rounded-full w-9 h-9"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">{TOGGLE_THEME[locale]}</span>
    </Button>
  );
}
