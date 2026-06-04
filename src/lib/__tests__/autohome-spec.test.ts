import { describe, it, expect } from "vitest";
import { parseGlobalAutohome, parseVisionSpec, extractGlobalSeriesId, isAutohomeGlobalUrl, isAutohomeCnConfigUrl } from "../autohome-spec";

// Mirrors the real global.autohome.com __NEXT_DATA__ shape (titlelist groups with
// per-trim values[], datalist trims with paramconfList fallback).
const nextData = {
  props: {
    pageProps: {
      initData: {
        bread: { brandName: "Hongqi", seriesName: "Hongqi E-HS9", specName: "2023 690km Standard" },
        titlelist: [
          { itemType: "Basic Information", items: [{ itemName: "Top Speed(km/h)", titleId: 835, values: ["200", "210"] }] },
          {
            itemType: "Body",
            items: [
              { itemName: "Length (mm)", titleId: 837, values: ["5209", "5209"] },
              { itemName: "Wheelbase (mm)", titleId: 850, values: ["3110", "-"] }, // "-" should be dropped
            ],
          },
          { itemType: "Battery/Charging", items: [{ itemName: "Battery Capacity (kWh)", titleId: 872, values: [null, "99"] }] }, // null for trim 0 → from paramconfList
        ],
        datalist: [
          { specName: "2023 690km Standard", year: 2023, formatPrice: "No Quotation Available", paramconfList: [{ titleId: 872, itemName: "120" }] },
          { specName: "2023 510km Sport", year: 2023, price: 550000, priceUnit: "HK$", paramconfList: [] },
        ],
      },
    },
  },
};

const html = `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>`;

describe("parseGlobalAutohome", () => {
  const spec = parseGlobalAutohome(html, "https://global.autohome.com/en-hk/config/spec/2022")!;

  it("extracts model identity, ordered groups, and trims", () => {
    expect(spec.source).toBe("global");
    expect(spec.brand).toBe("Hongqi");
    expect(spec.model).toBe("Hongqi E-HS9");
    expect(spec.groups).toEqual(["Basic Information", "Body", "Battery/Charging"]);
    expect(spec.trims).toHaveLength(2);
  });

  it("maps per-trim param values from values[trimIndex]", () => {
    expect(spec.trims[0].params["Basic Information"]["Top Speed(km/h)"]).toBe("200");
    expect(spec.trims[1].params["Basic Information"]["Top Speed(km/h)"]).toBe("210");
    expect(spec.trims[0].params["Body"]["Length (mm)"]).toBe("5209");
  });

  it("falls back to paramconfList by titleId when values[ti] is null", () => {
    expect(spec.trims[0].params["Battery/Charging"]["Battery Capacity (kWh)"]).toBe("120"); // from paramconfList
    expect(spec.trims[1].params["Battery/Charging"]["Battery Capacity (kWh)"]).toBe("99"); // from values[1]
  });

  it("drops empty/'-' values and surfaces price", () => {
    expect(spec.trims[0].params["Body"]["Wheelbase (mm)"]).toBe("3110");
    expect(spec.trims[1].params["Body"]).not.toHaveProperty("Wheelbase (mm)"); // "-" dropped
    expect(spec.trims[0].price_raw).toBeNull(); // "No Quotation Available"
    expect(spec.trims[1].price_raw).toBe("HK$550,000");
  });

  it("returns null for HTML without __NEXT_DATA__", () => {
    expect(parseGlobalAutohome("<html>nope</html>", "https://global.autohome.com/x")).toBeNull();
  });
});

describe("parseVisionSpec (vision LLM JSON → SpecData)", () => {
  it("parses fenced JSON, derives ordered groups, drops empties", () => {
    const raw = "```json\n" + JSON.stringify({
      brand: "BYD",
      model: "Song Plus",
      trims: [
        { name: "DM-i 110km", price: "¥159,800", params: { Engine: { Displacement: "1.5L", Power: "" }, Body: { Length: "4775mm" } } },
        { name: "DM-i 150km", params: { Engine: { Displacement: "1.5L" }, Body: { Length: "4775mm", Wheelbase: "-" } } },
      ],
    }) + "\n```";
    const spec = parseVisionSpec(raw, "https://car.autohome.com.cn/config/series/5569.html")!;
    expect(spec.source).toBe("cn");
    expect(spec.brand).toBe("BYD");
    expect(spec.groups).toEqual(["Engine", "Body"]);
    expect(spec.trims).toHaveLength(2);
    expect(spec.trims[0].params.Engine.Displacement).toBe("1.5L");
    expect(spec.trims[0].params.Engine).not.toHaveProperty("Power"); // empty dropped
    expect(spec.trims[1].params.Body).not.toHaveProperty("Wheelbase"); // "-" dropped
    expect(spec.trims[0].price_raw).toBe("¥159,800");
  });
  it("returns null for unrecoverable input", () => {
    expect(parseVisionSpec("sorry, I cannot read this", "https://x")).toBeNull();
    expect(parseVisionSpec(JSON.stringify({ trims: [] }), "https://x")).toBeNull();
  });
});

describe("extractGlobalSeriesId", () => {
  const wrap = (pp: object) => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: pp } })}</script>`;
  it("reads seriesId from bread", () => {
    expect(extractGlobalSeriesId(wrap({ initData: { bread: { seriesId: 878 } } }))).toBe(878);
  });
  it("falls back to pageProps.seriesId when initData is empty (client-rendered page)", () => {
    expect(extractGlobalSeriesId(wrap({ initData: {}, seriesId: 478, specId: 1735 }))).toBe(478);
  });
  it("returns null when absent", () => {
    expect(extractGlobalSeriesId("<html>nope</html>")).toBeNull();
  });
});

describe("url matchers", () => {
  it("detects global vs CN config URLs", () => {
    expect(isAutohomeGlobalUrl("https://global.autohome.com/en-hk/config/spec/2022")).toBe(true);
    expect(isAutohomeGlobalUrl("https://car.autohome.com.cn/config/series/5569.html")).toBe(false);
    expect(isAutohomeCnConfigUrl("https://car.autohome.com.cn/config/series/5569.html")).toBe(true);
    expect(isAutohomeCnConfigUrl("https://www.autohome.com.cn/config/spec/43593.html")).toBe(true);
    expect(isAutohomeCnConfigUrl("https://global.autohome.com/en-hk/config/spec/2022")).toBe(false);
  });
});
