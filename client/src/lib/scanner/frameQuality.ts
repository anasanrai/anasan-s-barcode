import type { FrameQualityMetrics } from "./types";

/**
 * Fast frame quality analysis for real-time video stream.
 * Computes Laplacian variance (focus/sharpness metric) and photometric distribution
 * on an ROI pixel buffer in O(N) single-pass with stride sampling for ultra-low latency (<2ms).
 */
export function evaluateFrameQuality(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  stride = 2,
): FrameQualityMetrics {
  if (width < 8 || height < 8 || pixels.length === 0) {
    return {
      sharpness: 0,
      brightness: 0,
      contrast: 0,
      glareRatio: 0,
      isAcceptable: false,
      guidance: "BLURRY",
    };
  }

  let totalLuma = 0;
  let totalLumaSq = 0;
  let sampleCount = 0;
  let glareCount = 0;
  let laplacianSum = 0;
  let laplacianSumSq = 0;
  let laplacianCount = 0;

  const step = Math.max(1, stride);

  // 1. Single-pass brightness, contrast, and glare estimation
  for (let y = 0; y < height; y += step) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x += step) {
      const idx = rowOffset + x * 4;
      const luma = (pixels[idx] * 77 + pixels[idx + 1] * 150 + pixels[idx + 2] * 29) >> 8;
      totalLuma += luma;
      totalLumaSq += luma * luma;
      sampleCount++;

      if (luma > 242) {
        glareCount++;
      }
    }
  }

  const meanLuma = sampleCount > 0 ? totalLuma / sampleCount : 0;
  const varianceLuma = sampleCount > 0 ? Math.max(0, totalLumaSq / sampleCount - meanLuma * meanLuma) : 0;
  const stdLuma = Math.sqrt(varianceLuma);
  const glareRatio = sampleCount > 0 ? glareCount / sampleCount : 0;

  // 2. Discrete Laplacian kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
  for (let y = 1; y < height - 1; y += step) {
    const rowPrev = (y - 1) * width * 4;
    const rowCurr = y * width * 4;
    const rowNext = (y + 1) * width * 4;

    for (let x = 1; x < width - 1; x += step) {
      const idx = rowCurr + x * 4;
      const c = (pixels[idx] * 77 + pixels[idx + 1] * 150 + pixels[idx + 2] * 29) >> 8;
      const t = (pixels[rowPrev + x * 4] * 77 + pixels[rowPrev + x * 4 + 1] * 150 + pixels[rowPrev + x * 4 + 2] * 29) >> 8;
      const b = (pixels[rowNext + x * 4] * 77 + pixels[rowNext + x * 4 + 1] * 150 + pixels[rowNext + x * 4 + 2] * 29) >> 8;
      const l = (pixels[rowCurr + (x - 1) * 4] * 77 + pixels[rowCurr + (x - 1) * 4 + 1] * 150 + pixels[rowCurr + (x - 1) * 4 + 2] * 29) >> 8;
      const r = (pixels[rowCurr + (x + 1) * 4] * 77 + pixels[rowCurr + (x + 1) * 4 + 1] * 150 + pixels[rowCurr + (x + 1) * 4 + 2] * 29) >> 8;

      const lap = Math.abs(t + b + l + r - (c << 2));
      laplacianSum += lap;
      laplacianSumSq += lap * lap;
      laplacianCount++;
    }
  }

  const meanLap = laplacianCount > 0 ? laplacianSum / laplacianCount : 0;
  const varianceLap = laplacianCount > 0 ? Math.max(0, laplacianSumSq / laplacianCount - meanLap * meanLap) : 0;
  const sharpnessScore = Math.round(varianceLap * 10) / 10;

  // Determine guidance based on physical conditions
  let guidance: FrameQualityMetrics["guidance"] = null;
  let isAcceptable = true;

  if (meanLuma < 35) {
    guidance = "LOW_LIGHT";
    if (meanLuma < 18) isAcceptable = false;
  } else if (meanLuma > 235) {
    guidance = "TOO_BRIGHT";
  } else if (glareRatio > 0.35 && stdLuma < 30) {
    guidance = "GLARE";
  } else if (sharpnessScore < 5 && stdLuma < 15) {
    guidance = "BLURRY";
    isAcceptable = false;
  }

  return {
    sharpness: sharpnessScore,
    brightness: Math.round(meanLuma),
    contrast: Math.round(stdLuma),
    glareRatio: Math.round(glareRatio * 100) / 100,
    isAcceptable,
    guidance,
  };
}
