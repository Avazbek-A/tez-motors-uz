import { describe, it, expect } from "vitest";
import { cosineSimilarity, generateVoiceSignature, isVoiceMatch } from "../biometrics";

describe("Voice Biometrics Engine", () => {
  describe("cosineSimilarity", () => {
    it("returns 1.0 for identical vectors", () => {
      const v1 = [0.5, 0.3, 0.4, 0.2];
      expect(cosineSimilarity(v1, v1)).toBeCloseTo(1.0, 5);
    });

    it("returns 0.0 for orthogonal vectors", () => {
      const v1 = [1.0, 0.0];
      const v2 = [0.0, 1.0];
      expect(cosineSimilarity(v1, v2)).toBe(0.0);
    });

    it("correctly calculates similarity for close vectors", () => {
      const v1 = [0.5, 0.5, 0.5, 0.5];
      const v2 = [0.51, 0.49, 0.52, 0.48];
      const sim = cosineSimilarity(v1, v2);
      expect(sim).toBeGreaterThan(0.99);
      expect(sim).toBeLessThan(1.0);
    });

    it("returns 0.0 for size mismatches", () => {
      expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });
  });

  describe("generateVoiceSignature", () => {
    it("generates a consistent 4-dimensional vector from seed", () => {
      const sig1 = generateVoiceSignature(null, 10, "+998901234567");
      const sig2 = generateVoiceSignature(null, 10, "+998901234567");
      expect(sig1).toHaveLength(4);
      expect(sig1).toEqual(sig2);
      expect(sig1.every(v => v >= 0 && v <= 1)).toBe(true);
    });

    it("generates different vectors for different seeds", () => {
      const sig1 = generateVoiceSignature(null, 10, "+998901234567");
      const sig2 = generateVoiceSignature(null, 10, "+998901111111");
      expect(sig1).not.toEqual(sig2);
    });

    it("analyzes audio buffer to produce realistic signatures", () => {
      const buffer1 = Buffer.from(new Array(500).fill(0).map((_, i) => Math.floor(Math.sin(i / 10) * 60 + 128)));
      const buffer2 = Buffer.from(new Array(500).fill(0).map((_, i) => Math.floor(Math.sin(i / 2) * 20 + 128)));
      
      const sig1 = generateVoiceSignature(buffer1, 5, "");
      const sig2 = generateVoiceSignature(buffer2, 5, "");
      
      expect(sig1).toHaveLength(4);
      expect(sig2).toHaveLength(4);
      expect(sig1).not.toEqual(sig2);
    });
  });

  describe("isVoiceMatch", () => {
    it("flags match for high similarity vectors", () => {
      const v1 = [0.5, 0.3, 0.4, 0.2];
      const v2 = [0.51, 0.31, 0.39, 0.21];
      expect(isVoiceMatch(v1, v2, 0.95)).toBe(true);
    });

    it("flags non-match for low similarity vectors", () => {
      const v1 = [0.9, 0.1, 0.1, 0.1];
      const v2 = [0.1, 0.9, 0.1, 0.1];
      expect(isVoiceMatch(v1, v2, 0.95)).toBe(false);
    });
  });
});
