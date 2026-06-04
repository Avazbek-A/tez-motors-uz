"use client";

import { useEffect, useState } from "react";
import { Share2, Loader2, Copy, Check, ExternalLink } from "lucide-react";

interface Car {
  id: string;
  brand: string;
  model: string;
  year: number | null;
  price_usd: number | null;
  thumbnail: string | null;
  images: string[] | null;
}
interface Listing {
  id: string;
  car_id: string;
  channel: string;
  status: string;
  title: string | null;
  body: string | null;
  external_url: string | null;
  created_at: string;
}

const CHANNELS = ["olx", "avtoelon", "telegram", "instagram", "facebook"] as const;
const FEEDS = [
  { label: "Google Merchant", href: "/api/feed/google.xml" },
  { label: "Meta catalog (CSV)", href: "/api/feed/meta.csv" },
  { label: "OLX autoload (XML)", href: "/api/feed/olx.xml" },
];

export default function AdminDistributionPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/distribution");
      const data = await res.json();
      setCars(data.cars || []);
      setListings(data.listings || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function generate(carId: string, channel: string) {
    setBusy(`${carId}:${channel}`);
    try {
      const res = await fetch("/api/admin/distribution", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ car_id: carId, channel }),
      });
      const data = await res.json();
      if (data.listing) setListings((l) => [data.listing, ...l]);
    } finally {
      setBusy(null);
    }
  }

  async function markPublished(id: string) {
    const url = window.prompt("Published URL (optional, for attribution):") || null;
    await fetch("/api/admin/distribution", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status: "published", external_url: url }),
    });
    setListings((l) => l.map((x) => (x.id === id ? { ...x, status: "published", external_url: url } : x)));
  }

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Share2 className="h-5 w-5 text-lime" />
        <h1 className="text-xl font-bold">Distribution</h1>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/60 mb-2">
          Automatic feeds — point each platform at its URL (refreshes on their schedule):
        </p>
        <div className="flex flex-wrap gap-2">
          {FEEDS.map((f) => (
            <a
              key={f.href}
              href={f.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-xs hover:bg-white/10"
            >
              {f.label} <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4">
          {cars.map((car) => {
            const carListings = listings.filter((l) => l.car_id === car.id);
            return (
              <div key={car.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">
                    {car.brand} {car.model} {car.year ?? ""}
                    {car.price_usd ? (
                      <span className="text-white/50"> — ${Math.round(car.price_usd).toLocaleString("en-US")}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {CHANNELS.map((ch) => (
                      <button
                        key={ch}
                        onClick={() => generate(car.id, ch)}
                        disabled={busy === `${car.id}:${ch}`}
                        className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
                      >
                        {busy === `${car.id}:${ch}` ? "…" : `+ ${ch}`}
                      </button>
                    ))}
                  </div>
                </div>

                {carListings.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {carListings.map((l) => (
                      <div key={l.id} className="rounded border border-white/10 bg-black/20 p-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs uppercase tracking-wide text-white/50">
                            {l.channel} · {l.status}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => copy(l.id, l.body || "")}
                              className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                            >
                              {copied === l.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
                            </button>
                            {l.status === "draft" && (
                              <button
                                onClick={() => markPublished(l.id)}
                                className="rounded bg-lime/20 px-2 py-1 text-xs text-lime hover:bg-lime/30"
                              >
                                Mark published
                              </button>
                            )}
                            {l.external_url && (
                              <a
                                href={l.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                        <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-xs text-white/80">{l.body}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
