"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, RotateCw, Download } from "lucide-react";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

/**
 * Full-featured audio player for recorded calls: play/pause, scrub bar, current/
 * total time, ±10s skip, playback-speed selector (0.75×–2×) and download.
 * Wraps a real <audio> element with custom controls so it looks/behaves the same
 * across mobile + desktop. `src` is a blob/object URL or remote URL.
 */
export function AudioPlayer({ src, downloadName = "recording" }: { src: string; downloadName?: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);

  // Reset transport when the source changes (new recording).
  useEffect(() => {
    setPlaying(false);
    setCur(0);
    setDur(0);
  }, [src]);

  // MediaRecorder webm/mp4 blobs frequently report duration:Infinity until the
  // browser has scanned to the end. Force it: seek far past the end once, which
  // makes the browser compute the real duration, then snap back to the start.
  const resolveDuration = (a: HTMLAudioElement) => {
    if (a.duration === Infinity || isNaN(a.duration)) {
      const onTU = () => {
        a.removeEventListener("timeupdate", onTU);
        if (isFinite(a.duration)) setDur(a.duration);
        a.currentTime = 0;
      };
      a.addEventListener("timeupdate", onTU);
      a.currentTime = 1e7;
    } else {
      setDur(a.duration);
    }
  };

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play().catch(() => {});
  };
  const seek = (v: number) => {
    const a = ref.current;
    if (a) { a.currentTime = v; setCur(v); }
  };
  const skip = (delta: number) => {
    const a = ref.current;
    if (a) a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + delta));
  };
  const setSpeed = (r: number) => {
    const a = ref.current;
    if (a) a.playbackRate = r;
    setRate(r);
  };

  return (
    <div className="w-full rounded-xl border border-border bg-muted/20 p-3 space-y-2.5">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => resolveDuration(e.currentTarget as HTMLAudioElement)}
        onDurationChange={(e) => { const d = (e.currentTarget as HTMLAudioElement).duration; if (isFinite(d)) setDur(d); }}
        onTimeUpdate={(e) => setCur((e.currentTarget as HTMLAudioElement).currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <input
        type="range"
        min={0}
        max={dur || 0}
        step={0.1}
        value={Math.min(cur, dur || 0)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Seek"
        className="w-full h-1.5 accent-lime cursor-pointer"
      />
      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <span>{fmt(cur)}</span>
        <span>{fmt(dur)}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => skip(-10)} aria-label="Back 10 seconds" className="p-2 rounded-lg text-foreground hover:bg-muted/40 transition-colors">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="p-2.5 rounded-full bg-lime/15 text-lime hover:bg-lime/25 transition-colors">
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button type="button" onClick={() => skip(10)} aria-label="Forward 10 seconds" className="p-2 rounded-lg text-foreground hover:bg-muted/40 transition-colors">
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                aria-label={`Speed ${s}x`}
                className={`px-1.5 py-1 text-[10px] font-bold tabular-nums transition-colors ${
                  rate === s ? "bg-lime/15 text-lime" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
          <a href={src} download={downloadName} aria-label="Download" className="p-2 rounded-lg text-foreground hover:bg-muted/40 transition-colors">
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
