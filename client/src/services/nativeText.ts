/** Signal Field performance layer: use browser text recognition when a device exposes it, then fall back to the warmed local OCR worker. */

import type { OcrTextBlock } from "./ocrPipeline";

type NativeTextResult = { rawValue: string; boundingBox: DOMRectReadOnly };
type NativeTextDetector = { detect: (source: HTMLCanvasElement) => Promise<NativeTextResult[]> };
type NativeTextDetectorConstructor = new () => NativeTextDetector;

function getConstructor(): NativeTextDetectorConstructor | null {
  const candidate = (globalThis as typeof globalThis & { TextDetector?: NativeTextDetectorConstructor }).TextDetector;
  return typeof candidate === "function" ? candidate : null;
}

export class NativeTextService {
  private detector: NativeTextDetector | null = null;

  get isAvailable(): boolean { return Boolean(getConstructor()); }

  async detect(frame: HTMLCanvasElement): Promise<OcrTextBlock[]> {
    const TextDetector = getConstructor();
    if (!TextDetector) return [];
    try {
      this.detector ??= new TextDetector();
      const results = await this.detector.detect(frame);
      return results
        .filter((result) => result.rawValue.trim().length > 0)
        .map((result) => ({
          text: result.rawValue.trim(),
          confidence: 100,
          bbox: {
            x0: result.boundingBox.x,
            y0: result.boundingBox.y,
            x1: result.boundingBox.x + result.boundingBox.width,
            y1: result.boundingBox.y + result.boundingBox.height,
          },
          source: "native-text",
        }));
    } catch {
      return [];
    }
  }
}
