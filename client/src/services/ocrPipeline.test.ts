import { describe, expect, it } from "vitest";
import {
  evaluateOcrFrame,
  selectBarcodeAdjacentNumeric,
  selectProminentDisplayNumber,
  selectVerifiedPhotoOrderNumber,
  StabilityTracker,
} from "../ocrPipeline";

describe("evaluateOcrFrame", () => {
  it("rejects letters", () => {
    const result = evaluateOcrFrame(
      [{ text: "ABC123", confidence: 90, bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } }],
      { format: "CODE128", minLength: 4, maxLength: 20 }
    );
    expect(result.state).toBe("uncertain");
    expect(result.blocks[0].reason).toBe("contains-letters");
  });

  it("accepts valid digits", () => {
    const result = evaluateOcrFrame(
      [{ text: "12345678", confidence: 90, bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } }],
      { format: "CODE128", minLength: 4, maxLength: 20 }
    );
    expect(result.state).toBe("candidate");
    expect(result.candidate?.value).toBe("12345678");
  });

  it("rejects low confidence", () => {
    const result = evaluateOcrFrame(
      [{ text: "1234", confidence: 30, bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } }],
      { format: "CODE128", minLength: 4, maxLength: 20 }
    );
    expect(result.state).toBe("uncertain");
    expect(result.blocks[0].reason).toBe("low-confidence");
  });

  it("rejects separators", () => {
    const result = evaluateOcrFrame(
      [{ text: "12-34", confidence: 90, bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } }],
      { format: "CODE128", minLength: 4, maxLength: 20 }
    );
    expect(result.state).toBe("uncertain");
    expect(result.blocks[0].reason).toBe("contains-separators");
  });

  it("detects multiple numbers", () => {
    const result = evaluateOcrFrame(
      [
        { text: "1234", confidence: 90, bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
        { text: "5678", confidence: 90, bbox: { x0: 0, y0: 30, x1: 100, y1: 50 } },
      ],
      { format: "CODE128", minLength: 4, maxLength: 20 }
    );
    expect(result.state).toBe("multiple");
  });
});

describe("StabilityTracker", () => {
  it("confirms after required frames", () => {
    const tracker = new StabilityTracker(3);
    const candidate = { value: "1234", confidence: 90, area: 100, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } };
    expect(tracker.observe(candidate).confirmed).toBe(false);
    expect(tracker.observe(candidate).confirmed).toBe(false);
    expect(tracker.observe(candidate).confirmed).toBe(true);
  });

  it("resets on value change", () => {
    const tracker = new StabilityTracker(3);
    tracker.observe({ value: "1234", confidence: 90, area: 100, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } });
    const result = tracker.observe({ value: "5678", confidence: 90, area: 100, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } });
    expect(result.count).toBe(1);
    expect(result.confirmed).toBe(false);
  });
});

describe("selectVerifiedPhotoOrderNumber", () => {
  it("requires two independent reads", () => {
    const decisions = [
      evaluateOcrFrame(
        [{ text: "12345678", confidence: 90, bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } }],
        { format: "CODE128", minLength: 4, maxLength: 20 }
      ),
    ];
    const result = selectVerifiedPhotoOrderNumber(decisions);
    expect(result.state).toBe("uncertain");
  });

  it("confirms when verified twice", () => {
    const block = { text: "12345678", confidence: 90, bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } };
    const decisions = [
      evaluateOcrFrame([block], { format: "CODE128", minLength: 4, maxLength: 20 }),
      evaluateOcrFrame([block], { format: "CODE128", minLength: 4, maxLength: 20 }),
    ];
    const result = selectVerifiedPhotoOrderNumber(decisions);
    expect(result.state).toBe("candidate");
    expect(result.candidate?.value).toBe("12345678");
  });
});
