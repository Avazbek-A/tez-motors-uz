"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Bike, Loader2, Zap, Gauge, BatteryCharging } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { cn } from "@/lib/utils";
import type { Scooter } from "@/types/scooter";

const LABELS = {
  ru: { title: "Самокаты и электровелосипеды", subtitle: "Электросамокаты и e-bike — в наличии и под заказ", search: "Поиск по бренду или модели...", all: "Все типы", escooter: "Самокаты", ebike: "Электровелосипеды", noResults: "Ничего не найдено", inStock: "В наличии", outOfStock: "Под заказ", details: "Подробнее" },
  uz: { title: "Skuterlar va elektrovelosipedlar", subtitle: "Elektroskuter va e-bike — mavjud va buyurtma asosida", search: "Brend yoki model bo'yicha qidiring...", all: "Barcha turlar", escooter: "Skuterlar", ebike: "Elektrovelosipedlar", noResults: "Hech narsa topilmadi", inStock: "Mavjud", outOfStock: "Buyurtma asosida", details: "Batafsil" },
  en: { title: "Scooters & e-bikes", subtitle: "Electric scooters and e-bikes — in stock and on order", search: "Search by brand or model...", all: "All types", escooter: "Scooters", ebike: "E-bikes", noResults: "No results", inStock: "In stock", outOfStock: "Made to order", details: "Details" },
} as const;

export default function ScootersCatalogContent({ initialKind }: { initialKind?: string } = {}) {
  const { locale } = useLocale();
  const t = LABELS[locale as keyof typeof LABELS] || LABELS.ru;
  const qp = useSearchParams();

  const [scooters, setScooters] = useState<Scooter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState(initialKind ?? (qp?.get("kind") ?? ""));
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 12;

  const fetchScooters = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (kind) params.set("kind", kind);
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      const res = await fetch(`/api/scooters?${params.toString()}`);
      const data = await res.json();
      setScooters(data.scooters || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [search, kind, page]);

  useEffect(() => {
    const h = setTimeout(fetchScooters, search ? 300 : 0);
    return () => clearTimeout(h);
  }, [fetchScooters, search]);

  useEffect(() => { setPage(1); }, [search, kind]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading as="h1" title={t.title} subtitle={t.subtitle} />

        <div className="flex flex-col lg:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} className="pl-12 h-12" />
          </div>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="px-4 h-12 bg-card border border-border text-sm text-foreground">
            <option value="">{t.all}</option>
            <option value="escooter">{t.escooter}</option>
            <option value="ebike">{t.ebike}</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" /> ...</div>
        ) : scooters.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border">
            <Bike className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">{t.noResults}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {scooters.map((s) => (
              <Link key={s.id} href={localizedPath(locale, `/scooters/${s.slug}`)} className="group bg-card border border-border overflow-hidden hover:border-white/25 transition-all">
                <div className="aspect-video bg-[var(--bg-0)] relative overflow-hidden">
                  {s.images[0] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={s.images[0]} alt={`${s.brand} ${s.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/40"><Bike className="w-10 h-10" /></div>
                  )}
                  <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">{s.kind === "ebike" ? t.ebike : t.escooter}</Badge>
                </div>
                <div className="p-4 space-y-2">
                  <p className="font-semibold text-foreground truncate">{s.brand} {s.model}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground font-mono">
                    {s.motor_power_w ? <span className="inline-flex items-center gap-0.5"><Zap className="w-3 h-3" />{s.motor_power_w}W</span> : null}
                    {s.range_km ? <span className="inline-flex items-center gap-0.5"><BatteryCharging className="w-3 h-3" />{s.range_km}km</span> : null}
                    {s.top_speed_kmh ? <span className="inline-flex items-center gap-0.5"><Gauge className="w-3 h-3" />{s.top_speed_kmh}km/h</span> : null}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-lg font-bold font-mono text-foreground">{s.price_usd ? `$${s.price_usd}` : "—"}</span>
                    <span className={cn("text-xs font-mono", s.stock_qty > 0 ? "text-neon-green" : "text-muted-foreground")}>{s.stock_qty > 0 ? t.inStock : t.outOfStock}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>←</Button>
            <span className="text-sm font-mono text-muted-foreground">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>→</Button>
          </div>
        )}
      </div>
    </div>
  );
}
