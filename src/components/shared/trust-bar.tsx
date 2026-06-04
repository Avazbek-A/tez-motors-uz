import { ShieldCheck, Truck, BadgeCheck, CalendarClock } from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants";

type Loc = "ru" | "uz" | "en";

const COPY: Record<Loc, { years: string; delivered: string; deposit: string; warranty: string }> = {
  ru: {
    years: "лет на рынке",
    delivered: "авто доставлено",
    deposit: "Депозит — до получения авто",
    warranty: "Гарантия 1 год / 20 000 км",
  },
  uz: {
    years: "yil bozorda",
    delivered: "avto yetkazilgan",
    deposit: "Depozit — avtoni olguningizcha",
    warranty: "Kafolat 1 yil / 20 000 km",
  },
  en: {
    years: "years in business",
    delivered: "cars delivered",
    deposit: "Deposit held until you get the car",
    warranty: "1-year / 20,000 km warranty",
  },
};

/**
 * Reusable trust strip (Phase AL). Directly answers the importer's #1 buyer
 * fear — "will they actually deliver my car?" — with concrete proof: years in
 * business, real delivered count, deposit-safety, and the warranty. Presentational
 * (counts are passed in by a server parent that has them). `nowYear` is injected
 * so it stays a pure render with no Date dependency.
 */
export function TrustBar({
  locale = "ru",
  deliveredCount,
  nowYear,
}: {
  locale?: Loc;
  deliveredCount: number;
  nowYear: number;
}) {
  const c = COPY[locale];
  const years = Math.max(1, nowYear - SITE_CONFIG.foundedYear);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
        <CalendarClock className="h-5 w-5 text-primary shrink-0" />
        <div>
          <div className="text-xl font-bold text-foreground">{years}+</div>
          <div className="text-xs text-muted-foreground">{c.years}</div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
        <BadgeCheck className="h-5 w-5 text-primary shrink-0" />
        <div>
          <div className="text-xl font-bold text-foreground">{deliveredCount}+</div>
          <div className="text-xs text-muted-foreground">{c.delivered}</div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
        <div className="text-xs text-muted-foreground leading-snug">{c.deposit}</div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
        <Truck className="h-5 w-5 text-primary shrink-0" />
        <div className="text-xs text-muted-foreground leading-snug">{c.warranty}</div>
      </div>
    </div>
  );
}
