import { describe, it, expect } from "vitest";
import { normalizeModel, baseModelKey } from "../model-normalize";

describe("normalizeModel", () => {
  it("strips engine/fuel/drivetrain trim so catalog joins to marketplace base names", () => {
    expect(normalizeModel("H6 2.0T")).toBe("h6");
    expect(normalizeModel("H6 HEV")).toBe("h6");
    expect(normalizeModel("Song Plus DM-i")).toBe("song plus");
    expect(normalizeModel("Atto 3 EV")).toBe("atto 3");
  });

  it("strips chassis codes and embedded years", () => {
    expect(normalizeModel("5 series (g60) 2025")).toBe("5 series");
    expect(normalizeModel("EQS (x296) 2025")).toBe("eqs");
    expect(normalizeModel("X1 (u11) 2025")).toBe("x1");
  });

  it("KEEPS model-distinguishing tokens — different models must NOT merge", () => {
    expect(normalizeModel("Tiggo 8 Pro")).toBe("tiggo 8 pro");
    expect(normalizeModel("Tiggo 8")).toBe("tiggo 8");
    expect(normalizeModel("Tiggo 8 Pro")).not.toBe(normalizeModel("Tiggo 8"));
    expect(normalizeModel("Song Plus")).not.toBe(normalizeModel("Song"));
    expect(normalizeModel("Seal")).toBe("seal");
  });

  it("baseModelKey lowercases the brand and normalizes the model", () => {
    expect(baseModelKey("Haval", "H6 2.0T")).toBe("haval|h6");
    expect(baseModelKey("BYD", "Song Plus DM-i")).toBe("byd|song plus");
  });

  it("is safe on empty / junk input", () => {
    expect(normalizeModel("")).toBe("");
    expect(normalizeModel("2.0T")).toBe(""); // all-noise
  });
});
