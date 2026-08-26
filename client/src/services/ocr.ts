/** Signal Field design system: OCR runs locally in a throttled, single-worker pipeline so uncertain readings never become confirmed data. */

import { createWorker, PSM, type Worker } from "tesseract.js";
import type { OcrTextBlock } from "./ocrPipeline";

export type OcrFrame = { blocks: OcrTextBlock[]; engineConfidence: number };
export type RecognizeOptions = {
  includeSeparatedNumericWords?: boolean;
};

type OcrWord = OcrTextBlock;
type OcrLine = OcrTextBlock & { words?: OcrWord[] };

export interface OCRService {
  initialize(): Promise<void>;
  recognize(
    frame: HTMLCanvasElement,
    options?: RecognizeOptions
  ): Promise<OcrFrame>;
  recognizeFastScreen(
    frame: HTMLCanvasElement,
    options?: RecognizeOptions
  ): Promise<OcrFrame>;
  dispose(): Promise<void>;
  get isReady(): boolean;
}

export function blocksFromOcrLines(
  lines: OcrLine[],
  options: RecognizeOptions = {}
): OcrTextBlock[] {
  return lines.flatMap((line) => {
    const text = line.text.trim();
    const lineBlock: OcrTextBlock = {
      text: line.text,
      confidence: line.confidence,
      bbox: line.bbox,
      source: "line",
    };
    if (/^\d+$/.test(text)) return [lineBlock];

    const words = line.words ?? [];
    const hasExplicitNumericWord = words.some((word) =>
      /^\d+$/.test(word.text.trim())
    );
    if (options.includeSeparatedNumericWords && hasExplicitNumericWord) {
      return [
        lineBlock,
        ...words
          .filter((word) => word.text.trim())
          .map((word) => ({ ...word, source: "word" })),
      ];
    }
    if (/[A-Za-z]/.test(text)) return [lineBlock];

    return words.length
      ? words.map((word) => ({ ...word, source: "word" }))
      : [lineBlock];
  });
}

export class BrowserOCRService implements OCRService {
  private worker: Worker | null = null;
  private pageMode = PSM.SPARSE_TEXT;
  private initPromise: Promise<void> | null = null;

  get isReady(): boolean {
    return this.worker !== null;
  }

  async initialize(): Promise<void> {
    if (this.worker) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async doInitialize(): Promise<void> {
    this.worker = await createWorker("eng", 1, {
      logger: () => undefined,
    });
    await this.worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    });
  }

  async recognize(
    frame: HTMLCanvasElement,
    options: RecognizeOptions = {}
  ): Promise<OcrFrame> {
    await this.initialize();
    if (!this.worker) return { blocks: [], engineConfidence: 0 };
    await this.setPageMode(PSM.SPARSE_TEXT);
    return this.recognizeFrame(frame, options);
  }

  async recognizeFastScreen(
    frame: HTMLCanvasElement,
    options: RecognizeOptions = {}
  ): Promise<OcrFrame> {
    await this.initialize();
    if (!this.worker) return { blocks: [], engineConfidence: 0 };
    await this.setPageMode(PSM.SINGLE_LINE);
    return this.recognizeFrame(frame, options);
  }

  private async setPageMode(mode: PSM): Promise<void> {
    if (!this.worker || this.pageMode === mode) return;
    await this.worker.setParameters({ tessedit_pageseg_mode: mode });
    this.pageMode = mode;
  }

  private async recognizeFrame(
    frame: HTMLCanvasElement,
    options: RecognizeOptions
  ): Promise<OcrFrame> {
    if (!this.worker) return { blocks: [], engineConfidence: 0 };
    const result = await this.worker.recognize(frame, {}, { blocks: true });
    const lines = (result.data.blocks ?? []).flatMap((block) =>
      block.paragraphs.flatMap((paragraph) => paragraph.lines)
    );
    const blocks = lines.length
      ? blocksFromOcrLines(lines, options)
      : result.data.text
          .split(/\r?\n/)
          .filter(Boolean)
          .map((text) => ({
            text,
            confidence: result.data.confidence,
            bbox: { x0: 0, y0: 0, x1: frame.width, y1: frame.height },
            source: "fallback",
          }));
    return { blocks, engineConfidence: result.data.confidence };
  }

  async dispose(): Promise<void> {
    if (!this.worker) return;
    await this.worker.terminate();
    this.worker = null;
  }
}

export class UnavailableOCRService implements OCRService {
  async initialize(): Promise<void> {}
  async recognize(): Promise<OcrFrame> {
    return { blocks: [], engineConfidence: 0 };
  }
  async recognizeFastScreen(): Promise<OcrFrame> {
    return { blocks: [], engineConfidence: 0 };
  }
  async dispose(): Promise<void> {}
  get isReady(): boolean {
    return false;
  }
}
