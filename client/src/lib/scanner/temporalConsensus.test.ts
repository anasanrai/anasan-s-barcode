import { describe, expect, it } from "vitest";
import { levenshtein, TemporalConsensusEngine } from "./temporalConsensus";
import type { CandidateResult } from "./types";

describe("Levenshtein Distance", () => {
  it("calculates exact edit distance between numeric strings", () => {
    expect(levenshtein("06281016003788", "06281016003788")).toBe(0);
    expect(levenshtein("06281016003788", "06281016003789")).toBe(1);
    expect(levenshtein("06281016003788", "6281016003788")).toBe(1);
    expect(levenshtein("123", "456")).toBe(3);
  });
});

describe("Temporal Consensus Engine", () => {
  const sampleGtin14: CandidateResult = {
    value: "06281016003788",
    format: "ITF14",
    confidence: 95,
    source: "ocr",
    isValidChecksum: true,
    timestamp: Date.now(),
  };

  const nonGtinCandidate: CandidateResult = {
    value: "15781512805", // Internal code without GTIN check digit
    format: "CODE128",
    confidence: 60,
    source: "ocr",
    isValidChecksum: false,
    timestamp: Date.now(),
  };

  const jitterCandidate: CandidateResult = {
    value: "15781512806", // 1-digit jitter
    format: "CODE128",
    confidence: 50,
    source: "ocr",
    isValidChecksum: false,
    timestamp: Date.now(),
  };

  it("locks immediately on high-confidence checksum-valid GTIN-14", () => {
    const engine = new TemporalConsensusEngine();
    const locked = engine.push(sampleGtin14);
    expect(locked).toBe("06281016003788");
  });

  it("requires multiple consistent frames and recovers from single jitter frame for non-GTIN", () => {
    const engine = new TemporalConsensusEngine({ instantGtinLock: false, minScoreForLock: 80 });

    // Frame 1: valid candidate (score ~40)
    expect(engine.push(nonGtinCandidate)).toBeNull();

    // Frame 2: motion blur jitter frame
    expect(engine.push(jitterCandidate)).toBeNull();

    // Frame 3: valid candidate returns
    const result = engine.push(nonGtinCandidate);
    expect(result).toBe("15781512805");
  });

  it("prunes expired frames after timeout", () => {
    const engine = new TemporalConsensusEngine({ expiryMs: 100, minScoreForLock: 90, instantGtinLock: false });
    const oldTime = Date.now() - 500;
    const oldCand: CandidateResult = { ...sampleGtin14, timestamp: oldTime };

    engine.push(oldCand);
    expect(engine.evaluate()).toBeNull();
  });
});
