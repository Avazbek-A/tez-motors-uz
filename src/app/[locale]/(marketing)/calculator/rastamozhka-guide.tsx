import Link from "next/link";
import { ArrowRight, Zap, ShieldCheck, FileText, AlertTriangle } from "lucide-react";
import {
  dutyRate,
  utilizationBrv,
  BRV_SUM,
  CLEARANCE_BRV,
  type VehicleAge,
} from "@/lib/customs-uz";
import { CUSTOMS_RATES, legalBasisNote } from "@/lib/customs-rates";
import { FAQSchema } from "@/components/shared/structured-data";

/**
 * Server-rendered растаможка authority hub — the content half of /calculator.
 *
 * Every rate table is DERIVED from the customs engine (customs-uz.ts) at render
 * time, so the prose and the interactive calculator can never drift, and the
 * legal-basis citations come from customs-rates.ts. This section is what wins the
 * informational queries ("сколько стоит растаможка", "утильсбор таблица",
 * "растаможка электромобиля", "можно ли ввезти авто старше 7 лет") alongside the
 * tool query the calculator already targets — and it makes the FAQPage schema
 * guideline-safe because the Q&As are visible on the page.
 *
 * NB: HowTo rich results were deprecated by Google in 2023; we emit FAQPage
 * (still consumed by Yandex + as an entity signal) and rely on the rich body
 * copy rather than HowTo markup.
 */

type L = "ru" | "uz" | "en";

const AGES: VehicleAge[] = ["new", "used1to3", "used3plus"];

// Visible FAQ — also the single source for the FAQPage schema below.
const FAQ: Record<L, { q: string; a: string }[]> = {
  ru: [
    {
      q: "Из чего складывается стоимость растаможки авто в Узбекистане?",
      a: "Из четырёх частей: таможенная пошлина (зависит от возраста, объёма двигателя и наличия сертификата происхождения), НДС 12%, утилизационный сбор (по объёму и возрасту) и таможенный сбор за оформление (2,5 БХМ). Электромобили освобождены от пошлины и акциза.",
    },
    {
      q: "Сколько стоит растаможить электромобиль?",
      a: "Для электромобиля таможенная пошлина и акциз — 0%. Платится только НДС 12% и утилизационный сбор: 120 БХМ для авто до 3 лет и 210 БХМ для авто старше 3 лет (с 1 мая 2025 года), плюс сбор за оформление.",
    },
    {
      q: "Какие автомобили можно ввозить в Узбекистан?",
      a: "По общему правилу — бензиновые и дизельные авто не старше 7 лет с экологическим классом не ниже Евро-5. Праворульные машины ввозить запрещено. На электромобили ограничения по возрасту и эко-классу не распространяются.",
    },
    {
      q: "Что такое утилизационный сбор и сколько он составляет?",
      a: "Это разовый платёж в БХМ (базовая расчётная величина = 412 000 сум), который зависит от объёма двигателя и возраста авто. Для ДВС — от 120 БХМ; для авто старше 3 лет добавляется надбавка. Для электромобилей он фиксированный (120/210 БХМ).",
    },
    {
      q: "Снизит ли сертификат происхождения (СТ-1) пошлину?",
      a: "Да. При ввозе из стран СНГ/ЕАЭС с сертификатом формы СТ-1 таможенная пошлина — 0%. Без сертификата происхождения пошлина может быть выше. Точные условия подтвердит брокер.",
    },
    {
      q: "Точный ли расчёт даёт калькулятор?",
      a: "Калькулятор считает по действующим тарифам РУз и совпадает с результатами таможенного бота до доллара. Это оценка: итоговую сумму с учётом сертификации и доставки подтвердит наш менеджер.",
    },
  ],
  uz: [
    {
      q: "O'zbekistonda avtomobilni rastamojka qilish narxi nimalardan iborat?",
      a: "To'rt qismdan: bojxona boji (yoshi, dvigatel hajmi va kelib chiqish sertifikatiga bog'liq), 12% QQS, utilizatsiya yig'imi (hajm va yoshga qarab) va rasmiylashtirish yig'imi (2,5 BHM). Elektromobillar bojdan va aktsizdan ozod.",
    },
    {
      q: "Elektromobilni rastamojka qilish qancha turadi?",
      a: "Elektromobil uchun bojxona boji va aktsiz — 0%. Faqat 12% QQS va utilizatsiya yig'imi to'lanadi: 3 yilgacha 120 BHM, 3 yildan oshganda 210 BHM (2025-yil 1-maydan), hamda rasmiylashtirish yig'imi.",
    },
    {
      q: "O'zbekistonga qanday avtomobillarni olib kirish mumkin?",
      a: "Umumiy qoidaga ko'ra — yoshi 7 yildan oshmagan, eko-sinfi Yevro-5 dan past bo'lmagan benzin va dizel avtomobillar. O'ng rulli mashinalarni olib kirish taqiqlangan. Elektromobillarga yosh va eko-sinf cheklovlari tatbiq etilmaydi.",
    },
    {
      q: "Utilizatsiya yig'imi nima va u qancha?",
      a: "Bu BHM dagi (bazaviy hisoblash miqdori = 412 000 so'm) bir martalik to'lov bo'lib, dvigatel hajmi va avtoning yoshiga bog'liq. ICE uchun — 120 BHM dan; 3 yildan katta avto uchun ustama qo'shiladi. Elektromobillar uchun u qat'iy (120/210 BHM).",
    },
    {
      q: "Kelib chiqish sertifikati (ST-1) bojni kamaytiradimi?",
      a: "Ha. MDH/EOII davlatlaridan ST-1 sertifikati bilan olib kirilganda bojxona boji — 0%. Sertifikatsiz boj yuqoriroq bo'lishi mumkin. Aniq shartlarni broker tasdiqlaydi.",
    },
    {
      q: "Kalkulyator aniq hisob beradimi?",
      a: "Kalkulyator OʻzR amaldagi tariflari boʻyicha hisoblaydi va bojxona botining natijalariga dollargacha mos keladi. Bu — taxminiy hisob; sertifikatlash va yetkazib berishni hisobga olgan yakuniy summani menejerimiz tasdiqlaydi.",
    },
  ],
  en: [
    {
      q: "What makes up the cost of clearing a car through customs in Uzbekistan?",
      a: "Four parts: customs duty (depends on age, engine size and whether you have an origin certificate), 12% VAT, the recycling (utilization) fee (by engine size and age), and a clearance fee (2.5 BRV). Electric vehicles are exempt from duty and excise.",
    },
    {
      q: "How much does it cost to clear an electric vehicle?",
      a: "For an EV, customs duty and excise are 0%. You only pay 12% VAT and the recycling fee: 120 BRV for cars under 3 years and 210 BRV for cars over 3 years (since May 1, 2025), plus the clearance fee.",
    },
    {
      q: "Which cars can be imported into Uzbekistan?",
      a: "As a general rule, petrol and diesel cars no older than 7 years with an emission class of at least Euro-5. Right-hand-drive cars are banned. Age and emission limits do not apply to electric vehicles.",
    },
    {
      q: "What is the recycling fee and how much is it?",
      a: "A one-off charge denominated in BRV (base value = 412,000 UZS) that scales with engine size and vehicle age. For ICE cars it starts at 120 BRV; cars over 3 years add a surcharge. For EVs it is fixed (120/210 BRV).",
    },
    {
      q: "Does an origin certificate (ST-1) lower the duty?",
      a: "Yes. Imported from CIS/EAEU countries with an ST-1 certificate, customs duty is 0%. Without an origin certificate the duty can be higher. A broker confirms the exact terms.",
    },
    {
      q: "Is the calculator's estimate accurate?",
      a: "It computes on current Uzbekistan tariffs and matches the customs bot's results to the dollar. It's an estimate; our manager confirms the final figure including certification and delivery.",
    },
  ],
};

const COPY = {
  ru: {
    h2: "Растаможка авто в Узбекистане: из чего складывается стоимость",
    intro:
      "Стоимость растаможки в Узбекистане складывается из четырёх платежей. Ниже — действующие ставки; калькулятор выше считает по ним же.",
    dutyH: "Таможенная пошлина",
    dutyIntro: "Зависит от возраста авто, объёма двигателя и наличия сертификата происхождения.",
    dutyCols: ["Возраст авто", "Ставка (с сертификатом)"],
    ageLabels: { new: "До 1 года", used1to3: "1–3 года", used3plus: "Более 3 лет" },
    dutyNotes: [
      "СНГ / ЕАЭС с сертификатом СТ-1 — пошлина 0%.",
      "Электромобили и последовательные гибриды — пошлина 0%.",
      "Без сертификата происхождения пошлина может быть выше.",
    ],
    feesH: "НДС, утильсбор и сбор за оформление",
    vat: "НДС — 12% от (таможенная стоимость + пошлина).",
    clearance: `Таможенный сбор за оформление — ${CLEARANCE_BRV} БХМ.`,
    brv: `БХМ (базовая расчётная величина) — ${BRV_SUM.toLocaleString("ru-RU")} сум.`,
    utilH: "Утилизационный сбор",
    utilIntro: "Разовый платёж в БХМ по объёму двигателя и возрасту авто.",
    utilCols: ["Двигатель", "До 3 лет", "Более 3 лет"],
    utilRows: { ev: "Электро / послед. гибрид", lt2: "До 2,0 л", mid: "2,0–3,0 л", gt3: "Более 3,0 л" },
    evH: "Растаможка электромобиля — 0% пошлины",
    evBody:
      "Электромобили освобождены от таможенной пошлины и акциза. Платится только НДС 12% и фиксированный утилизационный сбор (120 БХМ до 3 лет, 210 БХМ старше 3 лет — с 1 мая 2025 года). Возрастные и эко-ограничения на электромобили не распространяются.",
    eligH: "Какие авто можно ввозить",
    elig: [
      "Бензин / дизель — не старше 7 лет.",
      "Экологический класс — не ниже Евро-5.",
      "Праворульные авто — ввоз запрещён.",
      "Электромобили — без ограничений по возрасту и эко-классу.",
    ],
    faqH: "Частые вопросы о растаможке",
    ctaH: "Поможем с растаможкой под ключ",
    ctaBody: "Подберём авто, рассчитаем точную сумму, оформим таможню и доставим по Узбекистану.",
    ctaBtn: "Получить точный расчёт",
    unit: "см³",
    perCc: (pct: number, perCc: number) => (perCc > 0 ? `${pct}% + $${perCc}/см³` : `${pct}%`),
    brvCell: (n: number) => `${n} БХМ`,
    sourcesH: "Правовая основа",
  },
  uz: {
    h2: "O'zbekistonda avto rastamojka: narx nimalardan iborat",
    intro:
      "O'zbekistonda rastamojka narxi to'rt to'lovdan iborat. Quyida — amaldagi stavkalar; yuqoridagi kalkulyator ham shular bo'yicha hisoblaydi.",
    dutyH: "Bojxona boji",
    dutyIntro: "Avtoning yoshi, dvigatel hajmi va kelib chiqish sertifikatiga bog'liq.",
    dutyCols: ["Avto yoshi", "Stavka (sertifikat bilan)"],
    ageLabels: { new: "1 yilgacha", used1to3: "1–3 yil", used3plus: "3 yildan ortiq" },
    dutyNotes: [
      "MDH / EOII, ST-1 sertifikati bilan — boj 0%.",
      "Elektromobil va ketma-ket gibrid — boj 0%.",
      "Kelib chiqish sertifikatisiz boj yuqoriroq bo'lishi mumkin.",
    ],
    feesH: "QQS, utilizatsiya va rasmiylashtirish yig'imi",
    vat: "QQS — (bojxona qiymati + boj) ning 12%.",
    clearance: `Rasmiylashtirish yig'imi — ${CLEARANCE_BRV} BHM.`,
    brv: `BHM (bazaviy hisoblash miqdori) — ${BRV_SUM.toLocaleString("ru-RU")} so'm.`,
    utilH: "Utilizatsiya yig'imi",
    utilIntro: "Dvigatel hajmi va avto yoshiga qarab BHM dagi bir martalik to'lov.",
    utilCols: ["Dvigatel", "3 yilgacha", "3 yildan ortiq"],
    utilRows: { ev: "Elektro / ketma-ket gibrid", lt2: "2,0 l gacha", mid: "2,0–3,0 l", gt3: "3,0 l dan ortiq" },
    evH: "Elektromobil rastamojkasi — 0% boj",
    evBody:
      "Elektromobillar bojxona boji va aktsizdan ozod. Faqat 12% QQS va qat'iy utilizatsiya yig'imi to'lanadi (3 yilgacha 120 BHM, 3 yildan ortiq 210 BHM — 2025-yil 1-maydan). Yosh va eko cheklovlari elektromobillarga tatbiq etilmaydi.",
    eligH: "Qanday avtolarni olib kirish mumkin",
    elig: [
      "Benzin / dizel — 7 yildan oshmagan.",
      "Eko-sinf — Yevro-5 dan past emas.",
      "O'ng rulli avtolar — taqiqlangan.",
      "Elektromobillar — yosh va eko-sinf bo'yicha cheklovsiz.",
    ],
    faqH: "Rastamojka bo'yicha tez-tez beriladigan savollar",
    ctaH: "Rastamojkada to'liq yordam beramiz",
    ctaBody: "Avto tanlaymiz, aniq summani hisoblaymiz, bojxonadan o'tkazamiz va yetkazib beramiz.",
    ctaBtn: "Aniq hisobni olish",
    unit: "sm³",
    perCc: (pct: number, perCc: number) => (perCc > 0 ? `${pct}% + $${perCc}/sm³` : `${pct}%`),
    brvCell: (n: number) => `${n} BHM`,
    sourcesH: "Huquqiy asos",
  },
  en: {
    h2: "Car customs clearance in Uzbekistan: what makes up the cost",
    intro:
      "Clearance cost in Uzbekistan is four payments. Current rates are below; the calculator above uses the same ones.",
    dutyH: "Customs duty",
    dutyIntro: "Depends on the car's age, engine size and whether you hold an origin certificate.",
    dutyCols: ["Car age", "Rate (with certificate)"],
    ageLabels: { new: "≤1 year", used1to3: "1–3 years", used3plus: ">3 years" },
    dutyNotes: [
      "CIS / EAEU with an ST-1 certificate — 0% duty.",
      "Electric vehicles and series hybrids — 0% duty.",
      "Without an origin certificate the duty can be higher.",
    ],
    feesH: "VAT, recycling fee and clearance fee",
    vat: "VAT — 12% of (customs value + duty).",
    clearance: `Customs clearance fee — ${CLEARANCE_BRV} BRV.`,
    brv: `BRV (base calculation value) — ${BRV_SUM.toLocaleString("en-US")} UZS.`,
    utilH: "Recycling (utilization) fee",
    utilIntro: "A one-off charge in BRV by engine size and vehicle age.",
    utilCols: ["Engine", "≤3 years", ">3 years"],
    utilRows: { ev: "Electric / series hybrid", lt2: "Up to 2.0 L", mid: "2.0–3.0 L", gt3: "Over 3.0 L" },
    evH: "EV customs clearance — 0% duty",
    evBody:
      "Electric vehicles are exempt from customs duty and excise. You pay only 12% VAT and a fixed recycling fee (120 BRV under 3 years, 210 BRV over 3 years — since May 1, 2025). Age and emission limits do not apply to EVs.",
    eligH: "Which cars can be imported",
    elig: [
      "Petrol / diesel — no older than 7 years.",
      "Emission class — at least Euro-5.",
      "Right-hand-drive cars — banned.",
      "Electric vehicles — no age or emission limit.",
    ],
    faqH: "Frequently asked questions about clearance",
    ctaH: "We handle customs clearance turn-key",
    ctaBody: "We source the car, compute the exact figure, clear customs and deliver across Uzbekistan.",
    ctaBtn: "Get an exact quote",
    unit: "cc",
    perCc: (pct: number, perCc: number) => (perCc > 0 ? `${pct}% + $${perCc}/cc` : `${pct}%`),
    brvCell: (n: number) => `${n} BRV`,
    sourcesH: "Legal basis",
  },
} as const;

export function RastamozhkaGuide({ locale }: { locale: L }) {
  const c = COPY[locale];

  // Tables derived from the engine so prose ↔ calculator can never drift.
  const dutyRows = AGES.map((age) => ({ age, rate: dutyRate("petrol", age, "certified") }));
  const utilRows = [
    { label: c.utilRows.ev, le3: utilizationBrv("electric", "new", 0), gt3: utilizationBrv("electric", "used3plus", 0) },
    { label: c.utilRows.lt2, le3: utilizationBrv("petrol", "new", 1500), gt3: utilizationBrv("petrol", "used3plus", 1500) },
    { label: c.utilRows.mid, le3: utilizationBrv("petrol", "new", 2500), gt3: utilizationBrv("petrol", "used3plus", 2500) },
    { label: c.utilRows.gt3, le3: utilizationBrv("petrol", "new", 3500), gt3: utilizationBrv("petrol", "used3plus", 3500) },
  ];

  const th = "text-left text-xs font-semibold text-muted-foreground px-4 py-3";
  const td = "px-4 py-3 text-sm text-foreground border-t border-border";

  return (
    <section className="border-t border-border bg-muted/20 py-16">
      <FAQSchema faqs={FAQ[locale].map((f) => ({ question: f.q, answer: f.a }))} />
      <div className="container-custom max-w-4xl space-y-12">
        {/* Intro */}
        <div className="space-y-3">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">{c.h2}</h2>
          <p className="text-muted-foreground">{c.intro}</p>
        </div>

        {/* Customs duty */}
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> {c.dutyH}
          </h3>
          <p className="text-sm text-muted-foreground">{c.dutyIntro}</p>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>{c.dutyCols[0]}</th>
                  <th className={th}>{c.dutyCols[1]}</th>
                </tr>
              </thead>
              <tbody>
                {dutyRows.map((r) => (
                  <tr key={r.age}>
                    <td className={td}>{c.ageLabels[r.age]}</td>
                    <td className={`${td} font-semibold`}>{c.perCc(r.rate.pct, r.rate.perCc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {c.dutyNotes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* VAT, recycling, clearance */}
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-foreground">{c.feesH}</h3>
          <ul className="space-y-1.5 text-sm text-foreground">
            <li>{c.vat}</li>
            <li>{c.clearance}</li>
            <li>{c.brv}</li>
          </ul>

          <h4 className="text-base font-semibold text-foreground pt-2">{c.utilH}</h4>
          <p className="text-sm text-muted-foreground">{c.utilIntro}</p>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>{c.utilCols[0]}</th>
                  <th className={th}>{c.utilCols[1]}</th>
                  <th className={th}>{c.utilCols[2]}</th>
                </tr>
              </thead>
              <tbody>
                {utilRows.map((r) => (
                  <tr key={r.label}>
                    <td className={td}>{r.label}</td>
                    <td className={`${td} font-semibold`}>{c.brvCell(r.le3)}</td>
                    <td className={`${td} font-semibold`}>{c.brvCell(r.gt3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* EV story */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 space-y-2">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> {c.evH}
          </h3>
          <p className="text-sm text-muted-foreground">{c.evBody}</p>
        </div>

        {/* Eligibility */}
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" /> {c.eligH}
          </h3>
          <ul className="grid sm:grid-cols-2 gap-2 text-sm text-foreground">
            {c.elig.map((e, i) => (
              <li key={i} className="rounded-lg border border-border bg-card px-4 py-3">{e}</li>
            ))}
          </ul>
        </div>

        {/* FAQ */}
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground">{c.faqH}</h2>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {FAQ[locale].map((f, i) => (
              <details key={i} className="group p-5">
                <summary className="cursor-pointer list-none font-semibold text-foreground flex items-center justify-between gap-3">
                  {f.q}
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Soft CTA */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">{c.ctaH}</h3>
            <p className="text-sm text-muted-foreground mt-1">{c.ctaBody}</p>
          </div>
          <Link
            href={`/${locale}/order`}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {c.ctaBtn}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Legal basis / citations */}
        <div className="space-y-2 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{c.sourcesH}</p>
          <ul className="space-y-1">
            {CUSTOMS_RATES.citations.map((cit, i) => (
              <li key={i}>
                {cit.what} — <span className="opacity-70">{cit.law}</span>
              </li>
            ))}
          </ul>
          <p className="opacity-70 pt-1">{legalBasisNote(locale)}</p>
        </div>
      </div>
    </section>
  );
}
