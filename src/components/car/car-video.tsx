"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AutoHome car-overview video, streamed DIRECT from AutoHome's CDN (no download).
 * /api/video/{mid} returns all quality variants (360p–4K). We auto-pick a default
 * from the visitor's connection and offer a manual quality dropdown; switching
 * quality preserves playback position. Renders nothing if it fails.
 */
type Variant = { value: number; label: string; url: string };

/** Highest variant the connection can comfortably handle (never auto-loads 4K). */
function pickDefault(vs: Variant[]): number {
  let cap = 400; // 1080p on a good connection
  try {
    const c = (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number; saveData?: boolean } }).connection;
    if (c) {
      if (c.saveData) cap = 100;
      else if (c.effectiveType === "slow-2g" || c.effectiveType === "2g") cap = 100;
      else if (c.effectiveType === "3g") cap = 200;
      else if (typeof c.downlink === "number" && c.downlink < 2) cap = 200;
      else if (typeof c.downlink === "number" && c.downlink < 5) cap = 300;
    }
  } catch { /* no Network Information API → keep default */ }
  const asc = [...vs].sort((a, b) => a.value - b.value);
  return (asc.filter((v) => v.value <= cap).pop() || asc[0]).value;
}

const SUB_LABELS: Record<string, string> = { ru: "Русский", uz: "O'zbekcha", en: "English" };

export function CarVideo({
  mid,
  poster,
  subLangs = [],
  defaultLang = "ru",
}: {
  mid: string;
  poster?: string;
  /** Subtitle languages available for this clip (keys of spec_data.subtitles). */
  subLangs?: string[];
  /** Which subtitle track to show by default (the visitor's locale). */
  defaultLang?: string;
}) {
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [cur, setCur] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resume = useRef<{ t: number; play: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/video/${mid}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!alive) return;
        const vs: Variant[] = Array.isArray(d?.variants) ? d.variants : [];
        if (!vs.length) { setFailed(true); return; }
        setVariants(vs);
        setCur(pickDefault(vs));
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [mid]);

  function changeQuality(value: number) {
    const v = videoRef.current;
    if (v) resume.current = { t: v.currentTime, play: !v.paused };
    setCur(value);
  }

  if (failed) return null;
  const src = variants && cur != null ? variants.find((v) => v.value === cur)?.url : undefined;
  const subDefault = subLangs.includes(defaultLang) ? defaultLang : subLangs[0];

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        preload="none"
        playsInline
        className="w-full h-full bg-black"
        onLoadedMetadata={() => {
          const r = resume.current; const v = videoRef.current;
          if (r && v) { try { v.currentTime = r.t; } catch {} if (r.play) v.play().catch(() => {}); resume.current = null; }
        }}
      >
        {subLangs.map((l) => (
          <track
            key={l}
            kind="subtitles"
            srcLang={l}
            label={SUB_LABELS[l] || l.toUpperCase()}
            src={`/api/video/${mid}/subtitles?lang=${l}`}
            default={l === subDefault}
          />
        ))}
      </video>
      {variants && variants.length > 1 && cur != null && (
        <select
          aria-label="Quality"
          value={cur}
          onChange={(e) => changeQuality(Number(e.target.value))}
          className="absolute top-2 right-2 z-10 bg-black/70 text-white text-xs rounded px-1.5 py-1 border border-white/20 cursor-pointer"
        >
          {variants.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}
