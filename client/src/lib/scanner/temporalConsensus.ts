import { isValidGtin, validateBarcode } from "@/lib/pelican";
import type { CandidateResult } from "./types";

export interface ConsensusOptions {
  windowSize?: number; // Size of rolling candidate history (default: 5)
  expiryMs?: number; // Max age of candidate in buffer (default: 1500ms)
  minScoreForLock?: number; // Score threshold to trigger lock (default: 65)
  instantGtinLock?: boolean; // Instant lock on valid GTIN checksum (default: true)
}

export interface CandidateEntry {
  candidate: CandidateResult;
  sharpness: number;
  weight: number;
}

/**
 * Levenshtein distance between two strings
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const row = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

export class TemporalConsensusEngine {
  private buffer: CandidateEntry[] = [];
  private readonly windowSize: number;
  private readonly expiryMs: number;
  private readonly minScoreForLock: number;
  private readonly instantGtinLock: boolean;

  constructor(options: ConsensusOptions = {}) {
    this.windowSize = options.windowSize ?? 5;
    this.expiryMs = options.expiryMs ?? 1500;
    this.minScoreForLock = options.minScoreForLock ?? 65;
    this.instantGtinLock = options.instantGtinLock ?? true;
  }

  /**
   * Push a new frame candidate into the consensus engine.
   * Returns confirmed candidate string if threshold met, or null if still searching.
   */
  public push(candidate: CandidateResult | null, sharpness = 50): string | null {
    const now = Date.now();
    this.prune(now);

    if (!candidate || !candidate.value) {
      return this.evaluate(now);
    }

    // Hardware barcodes and valid GTIN checksums can lock instantly
    if (candidate.source === "hardware" || (this.instantGtinLock && candidate.isValidChecksum && candidate.confidence > 80)) {
      this.reset();
      return candidate.value;
    }

    // Weight candidate based on confidence, checksum validity, and sharpness
    let weight = candidate.confidence * 0.01;
    if (candidate.isValidChecksum) weight *= 2.0;
    if (sharpness > 20) weight *= 1.2;

    this.buffer.push({
      candidate,
      sharpness,
      weight,
    });

    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    return this.evaluate(now);
  }

  /**
   * Evaluate consensus across buffered candidates.
   */
  public evaluate(now = Date.now()): string | null {
    this.prune(now);
    if (this.buffer.length === 0) return null;

    // Group candidates by exact value and compute aggregate score
    const scoreMap = new Map<string, { totalWeight: number; count: number; bestCand: CandidateResult }>();

    for (const entry of this.buffer) {
      const val = entry.candidate.value;
      const existing = scoreMap.get(val);
      if (existing) {
        existing.totalWeight += entry.weight;
        existing.count += 1;
        if (entry.candidate.confidence > existing.bestCand.confidence) {
          existing.bestCand = entry.candidate;
        }
      } else {
        scoreMap.set(val, {
          totalWeight: entry.weight,
          count: 1,
          bestCand: entry.candidate,
        });
      }
    }

    // Find best scoring candidate
    let bestValue: string | null = null;
    let highestScore = 0;

    scoreMap.forEach((data, val) => {
      let score = data.totalWeight * 35 + data.count * 20;

      // Bonus for valid GTIN checksum
      const isValid = isValidGtin(val);
      if (isValid) score += 30;

      // Cluster similarity bonus: if other candidates in buffer are 1 edit distance away
      for (const entry of this.buffer) {
        if (entry.candidate.value !== val) {
          const dist = levenshtein(val, entry.candidate.value);
          if (dist === 1) {
            score += entry.weight * 10;
          }
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestValue = val;
      }
    });

    if (bestValue && highestScore >= this.minScoreForLock) {
      const val = bestValue;
      this.reset();
      return val;
    }

    return null;
  }

  /**
   * Get current top candidate without clearing buffer (for live UI preview)
   */
  public getLeadingCandidate(): string | null {
    if (this.buffer.length === 0) return null;
    return this.buffer[this.buffer.length - 1].candidate.value;
  }

  /**
   * Reset the engine buffer (e.g. after scan completion or user reset)
   */
  public reset(): void {
    this.buffer = [];
  }

  private prune(now: number): void {
    this.buffer = this.buffer.filter((e) => now - e.candidate.timestamp <= this.expiryMs);
  }
}
