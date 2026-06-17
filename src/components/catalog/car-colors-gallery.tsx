"use client";

import { useState } from "react";
import type { CarColor } from "@/lib/autohome-spec";
import { CarGallery } from "@/components/catalog/car-gallery";

/**
 * Car gallery with exterior + interior COLOR swatches (from AutoHome's config
 * `var color` / `var innerColor`). Selecting a colour swaps the gallery to that
 * colour's key photos (remounting CarGallery via `key` resets its index). Falls
 * back to the plain gallery when no colour data is present.
 */
type Sel = { kind: "ext" | "int"; i: number };

/** Only allow `#rgb`/`#rrggbb`(/aa) — never inject arbitrary CSS from data. */
function safeHex(h: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(h) ? h : "#3a3a3f";
}
/** AutoHome dual-tone interiors come as "#000000/#F0F0F0" → split swatch. */
function swatchStyle(hex: string): React.CSSProperties {
  const parts = String(hex).split("/").map((s) => safeHex(s.trim())).slice(0, 2);
  if (parts.length === 2) return { background: `linear-gradient(135deg, ${parts[0]} 0 50%, ${parts[1]} 50% 100%)` };
  return { background: parts[0] };
}
function colorName(c: CarColor, locale: string): string {
  return (locale === "ru" ? c.name_ru : locale === "uz" ? c.name_uz : c.name_en) || c.name_en || c.name_cn;
}
const hasImgs = (c: CarColor) => Array.isArray(c.images) && c.images.length > 0;

export function CarColorsGallery({
  images,
  exteriorColors = [],
  interiorColors = [],
  brand,
  model,
  locale,
  hasPano = false,
}: {
  images: string[];
  exteriorColors?: CarColor[];
  interiorColors?: CarColor[];
  brand: string;
  model: string;
  locale: string;
  /** Car has a 360° walkthrough below — interior swatches route to it (AutoHome
   *  has no interior stills, so we never show exterior photos as "interior"). */
  hasPano?: boolean;
}) {
  const ext = exteriorColors.filter((c) => c?.hex);
  const int = interiorColors.filter((c) => c?.hex);

  // Default selection: first exterior colour that actually has photos.
  const firstExtWithImgs = ext.findIndex(hasImgs);
  const [sel, setSel] = useState<Sel | null>(firstExtWithImgs >= 0 ? { kind: "ext", i: firstExtWithImgs } : null);

  if (ext.length === 0 && int.length === 0) {
    return <CarGallery images={images} brand={brand} model={model} />;
  }

  const selected = sel ? (sel.kind === "ext" ? ext[sel.i] : int[sel.i]) : null;
  const shown = selected && hasImgs(selected) ? selected.images! : images;
  const galleryKey = sel ? `${sel.kind}-${sel.i}` : "base";

  const t = (ru: string, uz: string, en: string) => (locale === "ru" ? ru : locale === "uz" ? uz : en);

  const row = (kind: "ext" | "int", list: CarColor[], label: string) =>
    list.length > 0 && (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <span>{label}</span>
          {sel?.kind === kind && selected && <span className="text-foreground/80 normal-case tracking-normal">· {colorName(selected, locale)}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {list.map((c, i) => {
            const active = sel?.kind === kind && sel.i === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSel({ kind, i })}
                title={colorName(c, locale)}
                aria-label={colorName(c, locale)}
                className={`w-8 h-8 rounded-full border transition-all ${
                  active ? "border-neon-blue ring-2 ring-neon-blue/40 scale-110" : "border-border hover:border-foreground/50"
                } ${hasImgs(c) ? "" : "opacity-60"}`}
                style={swatchStyle(c.hex)}
              />
            );
          })}
        </div>
      </div>
    );

  // Interior selected but no interior stills exist (AutoHome doesn't expose them).
  // Don't pass exterior photos off as interior — show an honest note + route to 360°.
  const intNoPhotos = sel?.kind === "int" && selected != null && !hasImgs(selected);

  return (
    <div className="space-y-4">
      <CarGallery key={galleryKey} images={shown} brand={brand} model={model} />
      {intNoPhotos && (
        <div className="rounded-xl border border-border bg-foreground/5 px-3 py-2 text-xs text-muted-foreground">
          {t(
            "Фото интерьера для этого цвета недоступны — показано фото кузова.",
            "Bu rang uchun salon rasmlari yo‘q — kuzov rasmi ko‘rsatilgan.",
            "No interior stills for this color — showing the body photos.",
          )}
          {hasPano && (
            <a href="#car-360" className="ml-1 font-medium text-neon-blue hover:underline">
              {t("Открыть интерьер в 360° ↓", "360° da ochish ↓", "Open interior in 360° ↓")}
            </a>
          )}
        </div>
      )}
      <div className="space-y-3 rounded-2xl bg-foreground/5 border border-border p-4">
        {row("ext", ext, t("Цвет кузова", "Kuzov rangi", "Exterior color"))}
        {row("int", int, t("Цвет салона", "Salon rangi", "Interior color"))}
      </div>
    </div>
  );
}
