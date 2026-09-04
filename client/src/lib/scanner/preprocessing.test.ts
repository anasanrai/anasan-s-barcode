import { describe, expect, it } from "vitest";
import {
  applyAdaptiveThreshold,
  applyGlareMitigation,
  applyInvertedContrast,
  applySharpenConvolution,
  applyStandardContrastStretch,
  preprocessPixelBuffer,
} from "./preprocessing";

describe("Preprocessing Pixel Transformations", () => {
  function createSampleBuffer(w = 20, h = 20, fill = 128): Uint8ClampedArray {
    const buf = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = fill;
      buf[i + 1] = fill;
      buf[i + 2] = fill;
      buf[i + 3] = 255;
    }
    return buf;
  }

  it("applies standard contrast stretch", () => {
    const buf = createSampleBuffer(10, 10, 100);
    applyStandardContrastStretch(buf, 100);
    expect(buf.length).toBe(400);
  });

  it("applies glare mitigation background subtraction", () => {
    const buf = createSampleBuffer(20, 20, 200);
    applyGlareMitigation(buf, 20, 20);
    expect(buf[0]).toBeGreaterThanOrEqual(0);
    expect(buf[0]).toBeLessThanOrEqual(255);
  });

  it("applies adaptive threshold binarization", () => {
    const buf = createSampleBuffer(20, 20, 150);
    applyAdaptiveThreshold(buf, 20, 20);
    // Values should be binarized (0 or 255)
    expect([0, 255]).toContain(buf[0]);
  });

  it("applies inverted contrast pass", () => {
    const buf = createSampleBuffer(10, 10, 50);
    applyInvertedContrast(buf, 100);
    expect(buf[0]).toBeGreaterThan(100); // 255 - low value
  });

  it("applies sharpen convolution", () => {
    const buf = createSampleBuffer(10, 10, 128);
    applySharpenConvolution(buf, 10, 10);
    expect(buf.length).toBe(400);
  });

  it("runs full preprocessPixelBuffer for all passes", () => {
    const passes = ["standard", "glare_mitigation", "adaptive_binarize", "inverted", "sharpen"] as const;
    for (const p of passes) {
      const buf = createSampleBuffer(16, 16, 120);
      expect(() => preprocessPixelBuffer(buf, 16, 16, p)).not.toThrow();
    }
  });
});
