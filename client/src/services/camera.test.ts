import { describe, expect, it, vi } from "vitest";
import {
  CameraService,
  FrameMotionTracker,
  shouldWaitForFrameMotion,
  shouldWaitForScreenSharpness,
} from "./camera";

function frameFromLuminance(
  width: number,
  height: number,
  luminanceAt: (x: number, y: number) => number
): HTMLCanvasElement {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = luminanceAt(x, y);
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return {
    width,
    height,
    getContext: () => ({ getImageData: () => ({ data }) }),
  } as unknown as HTMLCanvasElement;
}

describe("CameraService.assessFrameQuality", () => {
  it("flags a flat frame as soft before OCR", () => {
    const frame = frameFromLuminance(96, 96, () => 128);
    expect(new CameraService().assessFrameQuality(frame).state).toBe("soft");
  });

  it("accepts a balanced high-contrast frame as ready", () => {
    const frame = frameFromLuminance(96, 96, (x, y) =>
      (x + y) % 4 < 2 ? 84 : 172
    );
    expect(new CameraService().assessFrameQuality(frame).state).toBe("ready");
  });

  it("identifies a dark high-contrast frame as needing more light", () => {
    const frame = frameFromLuminance(96, 96, (x, y) =>
      (x + y) % 4 < 2 ? 12 : 48
    );
    expect(new CameraService().assessFrameQuality(frame).state).toBe("dim");
  });

  it("identifies intense highlights as glare", () => {
    const frame = frameFromLuminance(96, 96, x => (x % 12 < 9 ? 255 : 112));
    expect(new CameraService().assessFrameQuality(frame).state).toBe("glare");
  });

  it("measures the barcode region rather than unrelated background clutter", () => {
    const frame = frameFromLuminance(96, 96, (x, y) =>
      x >= 40 && x < 56 && y >= 40 && y < 56
        ? (x + y) % 4 < 2
          ? 72
          : 184
        : 128
    );
    const camera = new CameraService();
    expect(camera.assessFrameQuality(frame).state).toBe("soft");
    expect(
      camera.assessFrameQuality(frame, { x0: 40, y0: 40, x1: 56, y1: 56 }).state
    ).toBe("ready");
  });
});

describe("CameraService.captureCenteredFrame", () => {
  it("draws a downscaled crop to the canvas dimensions instead of clipping it", () => {
    const drawImage = vi.fn();
    const video = {
      videoWidth: 2400,
      videoHeight: 1200,
    } as HTMLVideoElement;
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
    } as unknown as HTMLCanvasElement;

    const frame = new CameraService().captureCenteredFrame(video, canvas, true);

    expect(frame).toBe(canvas);
    expect(canvas.width).toBe(1120);
    expect(canvas.height).toBe(438);
    expect(drawImage).toHaveBeenCalledWith(
      video,
      96,
      168,
      2208,
      864,
      0,
      0,
      1120,
      438
    );
  });
});

describe("CameraService.createFastScreenFrame", () => {
  it("uses a centered, reduced screen band for the quick numeric-only OCR pass", () => {
    const drawImage = vi.fn();
    const output = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal("document", { createElement: () => output });

    try {
      const frame = { width: 1120, height: 438 } as HTMLCanvasElement;
      const result = new CameraService().createFastScreenFrame(frame);

      expect(result).toBe(output);
      expect(output.width).toBe(960);
      expect(output.height).toBe(210);
      expect(drawImage).toHaveBeenCalledWith(
        frame,
        0,
        97,
        1120,
        245,
        0,
        0,
        960,
        210
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("FrameMotionTracker", () => {
  it("requires sustained still frames before reporting the sensor as stable", () => {
    const tracker = new FrameMotionTracker(2, 10);
    const steady = frameFromLuminance(96, 96, (x, y) =>
      (x + y) % 4 < 2 ? 84 : 172
    );
    expect(tracker.observe(steady).stable).toBe(false);
    expect(tracker.observe(steady).stable).toBe(false);
    expect(tracker.observe(steady).stable).toBe(true);
  });

  it("resets the stable-frame count when the framing changes materially", () => {
    const tracker = new FrameMotionTracker(1, 10);
    const steady = frameFromLuminance(96, 96, (x, y) =>
      (x + y) % 4 < 2 ? 84 : 172
    );
    const moved = frameFromLuminance(96, 96, x => (x % 12 < 9 ? 255 : 24));
    tracker.observe(steady);
    expect(tracker.observe(moved).stable).toBe(false);
  });
});

describe("manual screen capture priority", () => {
  it("does not hold an explicit capture behind soft reflected-screen guidance", () => {
    expect(shouldWaitForScreenSharpness(true, 0)).toBe(false);
    expect(shouldWaitForScreenSharpness(false, 4)).toBe(true);
    expect(shouldWaitForScreenSharpness(false, 9)).toBe(false);
  });

  it("does not block immediate screen OCR behind first-frame motion feedback", () => {
    expect(shouldWaitForFrameMotion(false, true, true, false)).toBe(false);
    expect(shouldWaitForFrameMotion(false, true, false, false)).toBe(true);
    expect(shouldWaitForFrameMotion(true, true, false, false)).toBe(false);
  });
});
