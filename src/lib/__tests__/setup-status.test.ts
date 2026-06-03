import { describe, it, expect } from "vitest";
import { buildSetupStatus, INTEGRATIONS } from "../setup-status";

const allFalse = (): Record<string, boolean> => {
  const m: Record<string, boolean> = {};
  for (const i of INTEGRATIONS) for (const v of i.envVars) m[v] = false;
  return m;
};

describe("buildSetupStatus", () => {
  it("reports core not ready and nothing active when no env is set", () => {
    const s = buildSetupStatus(allFalse());
    expect(s.coreReady).toBe(false);
    expect(s.activeOptional).toBe(0);
    expect(s.integrations.every((i) => !i.active)).toBe(true);
  });

  it("activates a capability only when ALL its env vars are present", () => {
    const present = allFalse();
    present["PAYME_MERCHANT_ID"] = true; // only one of two
    const partial = buildSetupStatus(present).integrations.find((i) => i.key === "payme")!;
    expect(partial.active).toBe(false);
    expect(partial.missing).toEqual(["PAYME_MERCHANT_KEY"]);

    present["PAYME_MERCHANT_KEY"] = true;
    const full = buildSetupStatus(present).integrations.find((i) => i.key === "payme")!;
    expect(full.active).toBe(true);
    expect(full.missing).toEqual([]);
  });

  it("marks core ready when supabase + admin are set", () => {
    const present = allFalse();
    for (const v of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_PASSWORD"]) present[v] = true;
    expect(buildSetupStatus(present).coreReady).toBe(true);
  });

  it("honors an override (e.g. LLM enabled by Ollama URL, no key)", () => {
    const present = allFalse(); // LLM_API_KEY absent
    const llm = buildSetupStatus(present, { llm: true }).integrations.find((i) => i.key === "llm")!;
    expect(llm.active).toBe(true);
    expect(llm.missing).toEqual([]);
    // and it counts toward activeOptional
    expect(buildSetupStatus(present, { llm: true }).activeOptional).toBe(1);
  });

  it("counts active optional integrations without counting required ones", () => {
    const present = allFalse();
    present["LLM_API_KEY"] = true; // optional
    present["CRON_SECRET"] = true; // optional
    const s = buildSetupStatus(present);
    expect(s.activeOptional).toBe(2);
    expect(s.totalOptional).toBe(INTEGRATIONS.filter((i) => !i.required).length);
  });
});
