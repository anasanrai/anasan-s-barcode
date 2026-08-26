/** Signal Field design system: line-level OCR evaluation refuses ambiguity and exposes every automatic-capture decision. */

import { type BarcodeFormat, validateNumber } from "./number";

export type BoundingBox = { x0: number; y0: number; x1: number; y1: number };
export type OcrTextBlock = {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  source?: string;
};
export type RejectionReason =
  | "empty"
  | "low-confidence"
  | "contains-letters"
  | "contains-separators"
  | "contains-symbols"
  | "invalid-format"
  | "not-barcode-adjacent"
  | "not-display-primary";
export type ReviewedOcrBlock = OcrTextBlock & {
  area: number;
  accepted: boolean;
  reason?: RejectionReason;
};
export type ScanState =
  | "reading"
  | "uncertain"
  | "multiple"
  | "invalid-format"
  | "candidate"
  | "confirmed";
export type NumericCandidate = {
  value: string;
  confidence: number;
  area: number;
  bbox: BoundingBox;
};

export type FrameDecision = {
  state: Exclude<ScanState, "confirmed">;
  detail: string;
  candidate?: NumericCandidate;
  blocks: ReviewedOcrBlock[];
};

export type CandidateRules = {
  format: BarcodeFormat;
  minLength: number;
  maxLength: number;
  minimumConfidence?: number;
};

export function evaluateOcrFrame(
  blocks: OcrTextBlock[],
  rules: CandidateRules
): FrameDecision {
  const minimumConfidence = rules.minimumConfidence ?? 62;
  const reviewed = blocks
    .filter(block => block.text.trim().length > 0)
    .map((block): ReviewedOcrBlock => {
      const text = block.text.trim();
      const width = Math.max(0, block.bbox.x1 - block.bbox.x0);
      const height = Math.max(0, block.bbox.y1 - block.bbox.y0);
      const area = width * height || text.length;
      if (block.confidence < minimumConfidence)
        return {
          ...block,
          text,
          area,
          accepted: false,
          reason: "low-confidence",
        };
      if (/[A-Za-z]/.test(text))
        return {
          ...block,
          text,
          area,
          accepted: false,
          reason: "contains-letters",
        };
      if (/^[0-9\s._-]+$/.test(text) && /[^0-9]/.test(text))
        return {
          ...block,
          text,
          area,
          accepted: false,
          reason: "contains-separators",
        };
      if (!/^\d+$/.test(text))
        return {
          ...block,
          text,
          area,
          accepted: false,
          reason: "contains-symbols",
        };

      const validation = validateNumber(
        text,
        rules.format,
        rules.minLength,
        rules.maxLength
      );
      if (!validation.valid)
        return {
          ...block,
          text,
          area,
          accepted: false,
          reason: "invalid-format",
        };
      return { ...block, text, area, accepted: true };
    });

  const accepted = reviewed
    .filter(block => block.accepted)
    .sort((a, b) => b.area - a.area || b.confidence - a.confidence);
  if (accepted.length > 1) {
    return {
      state: "multiple",
      detail: "Multiple numeric lines detected. Frame exactly one line.",
      blocks: reviewed,
    };
  }

  const selected = accepted[0];
  if (selected) {
    return {
      state: "candidate",
      detail: "Numeric line found. Checking it across consecutive frames.",
      candidate: {
        value: selected.text,
        confidence: selected.confidence,
        area: selected.area,
        bbox: selected.bbox,
      },
      blocks: reviewed,
    };
  }

  if (reviewed.some(block => block.reason === "invalid-format")) {
    return {
      state: "invalid-format",
      detail:
        "Digits were found, but they do not fit the selected format or length rules.",
      blocks: reviewed,
    };
  }

  if (reviewed.length === 0)
    return {
      state: "reading",
      detail: "Point the camera at one clear line of numbers.",
      blocks: reviewed,
    };
  return {
    state: "uncertain",
    detail: "Uncertain text. Keep one sharp line of digits inside the frame.",
    blocks: reviewed,
  };
}

export function selectBarcodeAdjacentNumeric(
  blocks: OcrTextBlock[],
  barcodeRegions: BoundingBox[],
  rules: CandidateRules
): FrameDecision {
  const base = evaluateOcrFrame(blocks, rules);
  if (barcodeRegions.length === 0) return base;

  const matches = base.blocks
    .filter(block => block.accepted)
    .map(block => ({
      block,
      distance: nearestBarcodeDistance(block.bbox, barcodeRegions),
    }))
    .filter(
      (entry): entry is { block: ReviewedOcrBlock; distance: number } =>
        entry.distance !== null
    )
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        right.block.confidence - left.block.confidence
    );

  const matchSet = new Set(matches.map(entry => entry.block));
  const reviewed = base.blocks.map(block =>
    block.accepted && !matchSet.has(block)
      ? { ...block, accepted: false, reason: "not-barcode-adjacent" as const }
      : block
  );
  const selected = matches[0]?.block;
  if (!selected)
    return {
      state: "uncertain",
      detail:
        "Barcode found. Keep its printed number directly below the barcode inside the frame.",
      blocks: reviewed,
    };

  return {
    state: "candidate",
    detail: "Barcode-adjacent numeric identifier found.",
    candidate: {
      value: selected.text,
      confidence: selected.confidence,
      area: selected.area,
      bbox: selected.bbox,
    },
    blocks: reviewed,
  };
}

export function selectProminentDisplayNumber(
  blocks: OcrTextBlock[],
  rules: CandidateRules
): FrameDecision {
  const base = evaluateOcrFrame(blocks, rules);
  const matches = base.blocks
    .filter(
      block =>
        block.accepted && block.text.length >= Math.max(4, rules.minLength)
    )
    .sort(
      (left, right) =>
        right.text.length - left.text.length ||
        right.area - left.area ||
        right.confidence - left.confidence
    );
  const selected = matches[0];
  if (!selected)
    return {
      ...base,
      detail: "Hold the long order number still inside the frame.",
    };
  const runnerUp = matches[1];
  if (runnerUp && runnerUp.text.length >= selected.text.length - 1) {
    return {
      state: "multiple",
      detail:
        "Multiple long numbers found. Frame only the required order number.",
      blocks: base.blocks,
    };
  }
  const matchSet = new Set([selected]);
  const reviewed = base.blocks.map(block =>
    block.accepted && !matchSet.has(block)
      ? { ...block, accepted: false, reason: "not-display-primary" as const }
      : block
  );
  return {
    state: "candidate",
    detail: "Prominent display number found.",
    candidate: {
      value: selected.text,
      confidence: selected.confidence,
      area: selected.area,
      bbox: selected.bbox,
    },
    blocks: reviewed,
  };
}

export function selectVerifiedPhotoOrderNumber(
  decisions: FrameDecision[]
): FrameDecision {
  const blocks = decisions.flatMap(decision => decision.blocks);
  const candidates = decisions.flatMap(decision =>
    decision.candidate ? [decision.candidate] : []
  );
  if (candidates.length === 0) {
    const latest = decisions.at(-1);
    return {
      state: latest?.state === "multiple" ? "multiple" : "uncertain",
      detail:
        latest?.detail ||
        "No complete order number could be read from this photo.",
      blocks,
    };
  }

  const grouped = new Map<string, NumericCandidate[]>();
  for (const candidate of candidates)
    grouped.set(candidate.value, [
      ...(grouped.get(candidate.value) ?? []),
      candidate,
    ]);
  const groups = Array.from(grouped.values()).sort(
    (left, right) =>
      right[0]!.value.length - left[0]!.value.length ||
      right.length - left.length ||
      right[0]!.confidence - left[0]!.confidence
  );
  const selected = groups[0]!;
  const independentlyVerified = groups.filter(group => group.length >= 2);
  if (independentlyVerified.length > 1) {
    return {
      state: "multiple",
      detail:
        "More than one complete number was verified in this photo. Frame only the intended line.",
      blocks,
    };
  }
  if (selected.length < 2) {
    return {
      state: "uncertain",
      detail:
        "A complete order number was not verified twice. No barcode was created—retake the photo with the full line visible.",
      blocks,
    };
  }
  const confidence = Math.round(
    selected.reduce(
      (sum: number, candidate: NumericCandidate) => sum + candidate.confidence,
      0
    ) / selected.length
  );
  const largest = selected.reduce(
    (best: NumericCandidate, candidate: NumericCandidate) =>
      candidate.area > best.area ? candidate : best
  );
  return {
    state: "candidate",
    detail: "Complete order number verified across local photo reads.",
    candidate: { ...largest, confidence },
    blocks,
  };
}

function nearestBarcodeDistance(
  candidate: BoundingBox,
  barcodes: BoundingBox[]
): number | null {
  const candidateWidth = Math.max(1, candidate.x1 - candidate.x0);
  const candidateHeight = Math.max(1, candidate.y1 - candidate.y0);
  const distances = barcodes.flatMap(barcode => {
    const barcodeWidth = Math.max(1, barcode.x1 - barcode.x0);
    const barcodeHeight = Math.max(1, barcode.y1 - barcode.y0);
    const horizontalOverlap = Math.max(
      0,
      Math.min(candidate.x1, barcode.x1) - Math.max(candidate.x0, barcode.x0)
    );
    const centeredUnderBarcode =
      horizontalOverlap >= Math.min(candidateWidth * 0.5, barcodeWidth * 0.22);
    const verticalGap = candidate.y0 - barcode.y1;
    const immediateBelow =
      verticalGap >= -candidateHeight * 0.35 &&
      verticalGap <= Math.max(barcodeHeight * 1.25, candidateHeight * 4);
    return centeredUnderBarcode && immediateBelow
      ? [Math.max(0, verticalGap)]
      : [];
  });
  return distances.length ? Math.min(...distances) : null;
}

export class StabilityTracker {
  private lastValue = "";
  private count = 0;

  constructor(private readonly requiredFrames = 3) {}

  observe(candidate?: NumericCandidate): { count: number; confirmed: boolean } {
    if (!candidate) return this.reset();
    if (candidate.value === this.lastValue) this.count += 1;
    else {
      this.lastValue = candidate.value;
      this.count = 1;
    }
    return { count: this.count, confirmed: this.count >= this.requiredFrames };
  }

  reset(): { count: number; confirmed: false } {
    this.lastValue = "";
    this.count = 0;
    return { count: 0, confirmed: false };
  }
}
