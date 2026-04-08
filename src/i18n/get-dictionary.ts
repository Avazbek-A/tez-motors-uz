import type { Locale } from "./config";

const dictionaries = {
  ru: () => import("./dictionaries/ru.json").then((m) => m.default),
  uz: () => import("./dictionaries/uz.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
};

export async function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
