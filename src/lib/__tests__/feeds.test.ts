import { describe, it, expect } from "vitest";
import { buildGoogleFeed, buildMetaCsv, buildOlxFeed, carTitle, carLink, type FeedCar } from "../feeds";

const car: FeedCar = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "byd-song-plus-2024",
  brand: "BYD",
  model: "Song Plus",
  year: 2024,
  price_usd: 32000,
  description_ru: "Кроссовер с гибридной установкой",
  description_en: null,
  images: ["https://cdn.example.com/a.webp", "https://cdn.example.com/b.webp"],
  thumbnail: "https://cdn.example.com/thumb.webp",
  listing_type: "new",
  body_type: "suv",
  fuel_type: "hybrid",
  color: "white",
  mileage: 0,
};

const noImage: FeedCar = { ...car, id: "2", slug: "no-img", thumbnail: null, images: null };
const noPrice: FeedCar = { ...car, id: "3", slug: "no-price", price_usd: null };

describe("feed helpers", () => {
  it("carTitle joins brand model year", () => {
    expect(carTitle(car)).toBe("BYD Song Plus 2024");
  });
  it("carLink adds utm for a channel", () => {
    expect(carLink(car, "ru", "google")).toContain("/ru/catalog/byd-song-plus-2024");
    expect(carLink(car, "ru", "google")).toContain("utm_source=google");
    expect(carLink(car, "ru")).not.toContain("utm_source");
  });
});

describe("buildGoogleFeed", () => {
  it("emits a valid RSS item with g: fields and skips image/price-less cars", () => {
    const xml = buildGoogleFeed([car, noImage, noPrice], "ru");
    expect(xml).toContain("<g:id>11111111-1111-1111-1111-111111111111</g:id>");
    expect(xml).toContain("<g:price>32000 USD</g:price>");
    expect(xml).toContain("<g:condition>new</g:condition>");
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    // skipped
    expect(xml).not.toContain("no-img");
    expect(xml).not.toContain("no-price");
  });
  it("XML-escapes dynamic content", () => {
    const xml = buildGoogleFeed([{ ...car, model: "A & B <X>" }], "ru");
    expect(xml).toContain("A &amp; B &lt;X&gt;");
    expect(xml).not.toContain("A & B <X>");
  });
});

describe("buildMetaCsv", () => {
  it("emits a header + one row per valid car, CSV-quoted", () => {
    const csv = buildMetaCsv([car, noPrice], "ru");
    const lines = csv.split("\n");
    expect(lines[0]).toBe("id,title,description,availability,condition,price,link,image_link,brand");
    expect(lines).toHaveLength(2); // header + 1 (noPrice skipped)
    expect(lines[1]).toContain('"BYD Song Plus 2024"');
  });
  it("escapes embedded quotes by doubling", () => {
    const csv = buildMetaCsv([{ ...car, description_ru: 'has "quotes"' }], "ru");
    expect(csv).toContain('"has ""quotes"""');
  });
});

describe("buildOlxFeed", () => {
  it("emits an <ad> with images and used condition", () => {
    const xml = buildOlxFeed([{ ...car, listing_type: "used", mileage: 25000 }], "ru");
    expect(xml).toContain("<condition>used</condition>");
    expect(xml).toContain("<mileage>25000</mileage>");
    expect(xml).toContain("<image>https://cdn.example.com/a.webp</image>");
  });
});
