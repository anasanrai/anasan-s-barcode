import type { BarcodeFormat } from "@/components/BarcodePreview";

export type ScannerStatus =
  | "IDLE"
  | "STARTING"
  | "SEARCHING"
  | "CANDIDATE_DETECTED"
  | "VALIDATING"
  | "CONFIRMED"
  | "ERROR";

export type PreprocessPass = "standard" | "glare_mitigation" | "adaptive_binarize" | "inverted" | "sharpen";

export interface FrameQualityMetrics {
  sharpness: number; // Laplacian variance score (0 - 1000+)
  brightness: number; // Mean luma (0 - 255)
  contrast: number; // Standard deviation of luma
  glareRatio: number; // Fraction of saturated/blown-out pixels (>245)
  isAcceptable: boolean;
  guidance?: "LOW_LIGHT" | "TOO_BRIGHT" | "BLURRY" | "GLARE" | null;
}

export interface CandidateResult {
  value: string;
  format: BarcodeFormat;
  confidence: number; // 0 - 100
  source: "ocr" | "hardware" | "zxing";
  rawText?: string;
  isValidChecksum: boolean;
  timestamp: number;
}

export interface ScannerTelemetry {
  fps: number;
  frameProcessingMs: number;
  ocrMs: number;
  totalPipelineMs: number;
  lastSharpness: number;
  lastBrightness: number;
  status: ScannerStatus;
  detectedCandidate: string | null;
  activePass: string;
}

export interface ScanRuleConfig {
  minDigits: number;
  maxDigits: number;
  strictGtinOnly: boolean;
  allowedLengths?: number[];
  customPrefix?: string;
}

export const DEFAULT_SCAN_RULES: ScanRuleConfig = {
  minDigits: 8,
  maxDigits: 18,
  strictGtinOnly: false,
  allowedLengths: [8, 12, 13, 14],
};
