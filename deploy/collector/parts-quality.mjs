/**
 * Deterministic junk filter for scraped parts (no LLM). OLX searches for a part
 * keyword still return car-sale ads, scrap, and mis-priced noise — this drops the
 * obvious garbage so the catalogue is clean. Conservative (keeps anything plausibly
 * a part); a later LLM pass can refine names/fitment on what survives.
 */

// A title that mentions NONE of these part stems is almost certainly not a part.
const PART_STEMS = /фильтр|колодк|тормоз|диск|амортизатор|стойк|шаров|опор|подшипник|ступиц|суппорт|аккумулятор|\bакб\b|стартер|генератор|свеч|катушк|форсунк|фара|фонар|лампа|ксенон|бампер|капот|крыл|дверь|зеркал|решётк|решетк|молдинг|спойлер|подкрыл|брызгов|накладк|шрус|гранат|пыльник|рычаг|сайлентблок|втулк|ремень|цеп[ьи]|помпа|радиатор|насос|сальник|прокладк|глушител|катализатор|турбин|маслян|воздушн|салонн|щётк|щетк|дворник|стекл|зажиган|сцеплен|маховик|термостат|patron|filtr|kolodka|tormoz|amortizator|akkumulyator|far[ao]|bamper/i;

// Clear car-for-sale / irrelevant phrasing.
const NOT_A_PART = /прода[юёе][^.]{0,20}(авто|машин|кузов целиком)|sotiladi.*avto|на полный разбор|весь автомобиль|сдаю в аренду|арендую/i;

/** True ⇒ drop this row (not a real catalogue part). */
export function isJunkPart(name, priceUsd) {
  const n = String(name || "").toLowerCase().trim();
  if (!n || n.length < 4) return true;
  if (NOT_A_PART.test(n)) return true;
  if (!PART_STEMS.test(n)) return true; // no part term at all
  const p = priceUsd == null ? null : Number(priceUsd);
  if (p != null && (p < 1 || p > 8000)) return true; // $0.86 junk, or a whole car
  return false;
}
