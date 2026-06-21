# Local listings — ready-to-paste (Google Business Profile + Yandex.Business)

The two local-pack listings are the last owner-only SEO items: creating them needs
**your** authenticated Google / Yandex account + business-ownership verification
(SMS/postcard). Everything you'd type is pre-written below — create the account,
then copy-paste. NAP (name/address/phone) **must match exactly** what the site's
Organization schema emits (`src/components/shared/structured-data.tsx`) or the
local-pack signal weakens.

> ⚠️ Phone: use the **live** number from DB `site_settings` (singleton) — it
> overrides the constant. Confirm before publishing.

## Shared business data (NAP — keep identical everywhere)

| Field | Value |
|---|---|
| Name | **Tez Motors** |
| Address | ул. Катартал, 25, Чиланзарский район, Ташкент, 100185, Узбекистan |
| Geo | 41.29532, 69.216001 (matches the /contacts map pin) |
| Hours | Mon–Sat 09:00–19:00 (Sun closed) |
| Website | https://tezmotors.uz |
| Phone | *(live number from site_settings)* |
| Email | *(live email from site_settings)* |

## Google Business Profile (business.google.com)

- **Primary category:** Car dealer
- **Additional categories:** Used car dealer · Car importer · Auto broker · Electric vehicle charging-station-free dealer (skip if N/A)
- **Service area:** Tashkent + Samarkand, Bukhara, Andijan, Fergana, Namangan (matches `areaServed`)
- **Attributes:** Online appointments, On-site services, Wheelchair-accessible, Delivery
- **Products:** add the top in-stock models (BYD Song/Han/Seagull, Zeekr, Li Auto, Changan, Haval, Chery) — link each to its model page `tezmotors.uz/ru/catalog/brand/<brand>/<model>`
- **Description (RU, ≤750 chars):**
  > Tez Motors — импорт автомобилей из Китая в Узбекистан под ключ. Подбор, доставка, растаможка и гарантия. Электромобили, гибриды и кроссоверы: BYD, Zeekr, Li Auto, Changan, Haval, Chery и другие. Прозрачные цены, онлайн-калькулятор растаможки, доставка по всему Узбекистану.
- **Description (UZ):**
  > Tez Motors — Xitoydan O'zbekistonga avtomobil importi to'liq xizmat bilan: tanlash, yetkazib berish, rastamojka, kafolat. Elektromobil, gibrid va krossoverlar: BYD, Zeekr, Li Auto, Changan, Haval, Chery. Shaffof narxlar, onlayn rastamojka kalkulyatori.
- **Description (EN):**
  > Tez Motors imports cars from China to Uzbekistan turn-key: sourcing, delivery, customs, warranty. EVs, hybrids and crossovers — BYD, Zeekr, Li Auto, Changan, Haval, Chery and more. Transparent prices, online customs calculator, nationwide delivery.
- **Photos:** logo, storefront/showroom, 5–10 cars, team. (Reuse `/public/images/*`.)
- **Posts:** publish the two new blog guides as GBP "What's new" posts.

## Yandex.Business / Yandex Maps (yandex.ru/sprav)

- **Rubric (primary):** Автосалон → Secondary: Автомобили с пробегом, Импорт автомобилей
- **Same NAP, hours, geo, phone, site.**
- **Description (RU):** use the RU description above.
- **Features:** доставка, рассрочка/кредит, trade-in, онлайн-расчёт растаможки, гарантия.
- **Link the website** and enable the Yandex.Business → site verification (you already
  have Yandex Webmaster verified — see SEARCH_CONSOLE.md).
- **Photos + price list:** Yandex weights "commercial factors" heavily — upload prices,
  contacts, and assortment for a ranking boost.

## After both are live
- Add the GBP "place ID" / Yandex org id to the site if you later want a Map embed.
- Request a few customer **reviews** (the site already has `reviews` + AggregateRating
  schema; GBP/Yandex reviews compound the local signal).
- Re-check the local pack for "автосалон Ташкент" / "импорт авто Ташкент" in ~2–3 weeks.
