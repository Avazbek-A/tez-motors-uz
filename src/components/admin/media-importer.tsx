"use client";

import { useState } from "react";
import { Link2, Loader2, Download, Film, Settings2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Candidate {
  url: string;
  type: "image" | "video";
}

/**
 * Import images/video for a car or part from a source URL (AutoHome, Alibaba,
 * AliExpress, …) or by pasting direct image URLs. Extracts candidates, re-hosts
 * the chosen images to the dealer's own Storage bucket, and hands the new URLs
 * back to the parent form. Rights are the dealer's responsibility.
 */
export function MediaImporter({
  bucket,
  onImages,
  onVideo,
  onSpec,
  brand,
  model,
  year,
}: {
  bucket: "car-images" | "part-images";
  onImages: (urls: string[]) => void;
  onVideo?: (url: string) => void;
  /** When provided (car form), Extract also pulls the car config from the page. */
  onSpec?: (spec: Record<string, unknown>) => void;
  /** When provided (car form), enables one-click "Suggest photos" from Wikimedia. */
  brand?: string;
  model?: string;
  year?: string;
}) {
  const [pageUrl, setPageUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState("");
  const [importing, setImporting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);

  const canSuggest = !!(brand?.trim() && model?.trim());

  const suggest = async () => {
    if (!canSuggest) return;
    setSuggesting(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/media/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, model, year: year || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      const found: Candidate[] = Array.isArray(data.candidates) ? data.candidates : [];
      setCandidates(found);
      setSelected(new Set(found.map((c) => c.url)));
      setNote(
        found.length > 0
          ? `Found ${found.length} CC-licensed photo${found.length === 1 ? "" : "s"} for ${brand} ${model} — review, then Import.`
          : "No Wikimedia photos found for that model — paste a source URL or direct image URLs instead.",
      );
    } catch {
      setNote("Could not fetch suggestions — paste a source URL instead.");
    } finally {
      setSuggesting(false);
    }
  };

  const imageCandidates = candidates.filter((c) => c.type === "image");
  const videoCandidates = candidates.filter((c) => c.type === "video");

  const extract = async () => {
    if (!pageUrl.trim()) return;
    setExtracting(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/media/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: pageUrl.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      const found: Candidate[] = Array.isArray(data.candidates) ? data.candidates : [];
      setCandidates(found);
      setSelected(new Set(found.filter((c) => c.type === "image").map((c) => c.url)));

      // Cars: also pull the configuration from the same page (AI-assisted).
      if (onSpec) {
        try {
          const sres = await fetch("/api/admin/cars/extract-spec", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: pageUrl.trim() }),
          });
          const sdata = await sres.json().catch(() => ({}));
          setSpec(sdata.spec && typeof sdata.spec === "object" ? sdata.spec : null);
        } catch {
          setSpec(null);
        }
      }

      if (found.length === 0) {
        setNote("No media found on that page (it may block server fetches) — paste direct image URLs below instead.");
      }
    } catch {
      setNote("Could not read that page. Paste direct image URLs below instead.");
    } finally {
      setExtracting(false);
    }
  };

  const toggle = (url: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });

  const importSelected = async () => {
    const manualUrls = manual
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s));
    const urls = Array.from(new Set([...Array.from(selected), ...manualUrls])).slice(0, 12);
    if (urls.length === 0) {
      setNote("Select candidates or paste image URLs first.");
      return;
    }
    setImporting(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/media/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, bucket }),
      });
      const data = await res.json().catch(() => ({}));
      const ok: string[] = (data.results || []).filter((r: { url?: string }) => r.url).map((r: { url: string }) => r.url);
      const failed = (data.results || []).filter((r: { error?: string }) => r.error).length;
      if (ok.length > 0) onImages(ok);
      setManual("");
      setSelected(new Set());
      setNote(`Imported ${ok.length} image${ok.length === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}.`);
    } catch {
      setNote("Import failed — try again or paste direct URLs.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="rounded-[2px] border border-border bg-[var(--bg-3)]/50 p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <Link2 className="w-3.5 h-3.5" /> Import from URL
      </div>
      <div className="flex gap-2">
        <Input
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          placeholder="Paste an AutoHome / Alibaba / AliExpress page URL"
          className="flex-1 text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={extract} disabled={extracting || !pageUrl.trim()}>
          {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Extract"}
        </Button>
      </div>

      {canSuggest && (
        <Button type="button" variant="outline" size="sm" onClick={suggest} disabled={suggesting} className="w-full">
          {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Suggest photos ({brand} {model}, Wikimedia)</>}
        </Button>
      )}

      {videoCandidates.length > 0 && onVideo && (
        <div className="flex flex-wrap gap-2">
          {videoCandidates.slice(0, 4).map((c) => (
            <button
              key={c.url}
              type="button"
              onClick={() => { onVideo(c.url); setNote("Video URL set."); }}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              title={c.url}
            >
              <Film className="w-3.5 h-3.5" /> Use video
            </button>
          ))}
        </div>
      )}

      {onSpec && spec && Object.keys(spec).length > 0 && (
        <button
          type="button"
          onClick={() => {
            onSpec(spec);
            setNote("Applied car configuration — review before saving.");
          }}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Settings2 className="w-3.5 h-3.5" /> Apply configuration
          {(() => {
            const n = Object.keys(spec).filter((k) => k !== "specs").length;
            return n > 0 ? ` (${n} fields)` : "";
          })()}
        </button>
      )}

      {imageCandidates.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto">
          {imageCandidates.map((c) => (
            <button
              key={c.url}
              type="button"
              onClick={() => toggle(c.url)}
              className={`relative aspect-square border rounded-[2px] overflow-hidden ${selected.has(c.url) ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-border opacity-70"}`}
              title={c.url}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <textarea
        value={manual}
        onChange={(e) => setManual(e.target.value)}
        placeholder="…or paste direct image URLs (one per line)"
        rows={2}
        className="w-full rounded-[2px] border border-border bg-[var(--bg-3)] px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-[var(--accent)]"
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Re-hosted to your Storage. Use only imagery you have rights to (e.g. your supplier&apos;s product photos).
        </p>
        <Button type="button" size="sm" onClick={importSelected} disabled={importing}>
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4" /> Import</>}
        </Button>
      </div>
      {note && <p className="text-xs text-primary">{note}</p>}
    </div>
  );
}
