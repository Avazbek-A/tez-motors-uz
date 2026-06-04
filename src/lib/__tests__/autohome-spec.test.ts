import { describe, it, expect } from "vitest";
import { parseGlobalAutohome, isAutohomeGlobalUrl, isAutohomeCnConfigUrl } from "../autohome-spec";

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

describe("url matchers", () => {
  it("detects global vs CN config URLs", () => {
    expect(isAutohomeGlobalUrl("https://global.autohome.com/en-hk/config/spec/2022")).toBe(true);
    expect(isAutohomeGlobalUrl("https://car.autohome.com.cn/config/series/5569.html")).toBe(false);
    expect(isAutohomeCnConfigUrl("https://car.autohome.com.cn/config/series/5569.html")).toBe(true);
    expect(isAutohomeCnConfigUrl("https://www.autohome.com.cn/config/spec/43593.html")).toBe(true);
    expect(isAutohomeCnConfigUrl("https://global.autohome.com/en-hk/config/spec/2022")).toBe(false);
  });
});
