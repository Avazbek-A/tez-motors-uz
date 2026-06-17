import { describe, it, expect } from "vitest";
import { computeCustomsUz, resolveVehicleKind, BRV_SUM } from "../customs-uz";

describe("computeCustomsUz", () => {
  it("electric: no duty, 12% VAT, 120 BRV util, 2.5 BRV clearance, $300 cert", () => {
    const r = computeCustomsUz({ priceUsd: 33000, kind: "electric", usdUzs: 12600 });
    const by = Object.fromEntries(r.lines.map((l) => [l.key, l]));
    expect(by.duty).toBeUndefined(); // exempt → no duty line
    expect(by.vat.usdValue).toBe(Math.round(33000 * 0.12)); // 3960
    expect(by.util.sumValue).toBe(120 * BRV_SUM); // 49,440,000
    expect(by.util.usdValue).toBe(Math.round((120 * BRV_SUM) / 12600)); // ~3924
    expect(by.clearance.sumValue).toBe(2.5 * BRV_SUM); // 1,030,000
    expect(by.certificate.usdValue).toBe(300);
    expect(r.totalUsd).toBe(33000 + r.customsCostUsd);
  });

  it("petrol ICE 1800cc: duty = 15% + $1/cc, ICE util 120 BRV, $690 certs", () => {
    const r = computeCustomsUz({ priceUsd: 20000, kind: "petrol", engineCc: 1800, usdUzs: 12600 });
    const by = Object.fromEntries(r.lines.map((l) => [l.key, l]));
    expect(by.duty.usdValue).toBe(Math.round(20000 * 0.15 + 1800)); // 4800
    expect(by.vat.usdValue).toBe(2400);
    expect(by.util.detail).toBe("120 БРВ"); // <2000cc tier
    expect(by.certificate.usdValue).toBe(690);
  });

  it("ICE utilization tiers scale with engine size", () => {
    const u = (cc: number) => computeCustomsUz({ priceUsd: 20000, kind: "petrol", engineCc: cc }).lines.find((l) => l.key === "util")!;
    expect(u(1500).detail).toBe("120 БРВ");
    expect(u(2500).detail).toBe("180 БРВ");
    expect(u(3600).detail).toBe("300 БРВ");
  });

  it("phev is treated as duty-exempt like electric", () => {
    const r = computeCustomsUz({ priceUsd: 30000, kind: "phev" });
    expect(r.lines.find((l) => l.key === "duty")).toBeUndefined();
  });

  it("delivery is folded into the customs (VAT/duty) base", () => {
    const a = computeCustomsUz({ priceUsd: 20000, kind: "electric", usdUzs: 12600 });
    const b = computeCustomsUz({ priceUsd: 20000, kind: "electric", deliveryUsd: 2000, usdUzs: 12600 });
    expect(b.customsValueUsd).toBe(22000);
    const vatA = a.lines.find((l) => l.key === "vat")!.usdValue;
    const vatB = b.lines.find((l) => l.key === "vat")!.usdValue;
    expect(vatB).toBeGreaterThan(vatA); // VAT rises with delivery in the base
  });

  it("resolveVehicleKind maps free-form fuel strings", () => {
    expect(resolveVehicleKind("электро")).toBe("electric");
    expect(resolveVehicleKind("Бензин")).toBe("petrol");
    expect(resolveVehicleKind("дизель")).toBe("diesel");
    expect(resolveVehicleKind("гибрид")).toBe("hybrid");
    expect(resolveVehicleKind("plug-in hybrid")).toBe("phev");
  });
});
