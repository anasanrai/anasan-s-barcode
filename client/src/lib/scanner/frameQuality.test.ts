import { describe, expect, it } from "vitest";
import { evaluateFrameQuality } from "./frameQuality";

describe("Frame Quality Evaluator", () => {
  it("returns zeros and unaccetable for empty buffers", () => {
    const res = evaluateFrameQuality(new Uint8ClampedArray(0), 0, 0);
    expect(res.isAcceptable).toBe(false);
    expect(res.guidance).toBe("BLURRY");
  });

  it("detects low light frames correctly", () => {
    const w = 32;
    const h = 32;
    const buf = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = 10;
      buf[i + 1] = 10;
      buf[i + 2] = 10;
      buf[i + 3] = 255;
    }

    const res = evaluateFrameQuality(buf, w, h);
    expect(res.brightness).toBeLessThan(20);
    expect(res.guidance).toBe("LOW_LIGHT");
    expect(res.isAcceptable).toBe(false);
  });

  it("detects glare / washed out frames", () => {
    const w = 32;
    const h = 32;
    const buf = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = 250;
      buf[i + 1] = 250;
      buf[i + 2] = 250;
      buf[i + 3] = 255;
    }

    const res = evaluateFrameQuality(buf, w, h);
    expect(res.brightness).toBeGreaterThan(240);
    expect(["TOO_BRIGHT", "GLARE"]).toContain(res.guidance);
  });

  it("computes higher sharpness for high-contrast edge patterns", () => {
    const w = 32;
    const h = 32;
    // Step edge image (left half 0, right half 255)
    const sharpBuf = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const val = x < 16 ? 0 : 255;
        sharpBuf[idx] = val;
        sharpBuf[idx + 1] = val;
        sharpBuf[idx + 2] = val;
        sharpBuf[idx + 3] = 255;
      }
    }

    // Flat grey
    const flatBuf = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < flatBuf.length; i += 4) {
      flatBuf[i] = 128;
      flatBuf[i + 1] = 128;
      flatBuf[i + 2] = 128;
      flatBuf[i + 3] = 255;
    }

    const sharpRes = evaluateFrameQuality(sharpBuf, w, h);
    const flatRes = evaluateFrameQuality(flatBuf, w, h);

    expect(sharpRes.sharpness).toBeGreaterThan(flatRes.sharpness);
    expect(sharpRes.isAcceptable).toBe(true);
  });
});
