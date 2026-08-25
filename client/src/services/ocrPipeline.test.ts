/** Signal Field design system: OCR pipeline tests enforce strict one-line numeric acceptance and explainable rejections. */

import { describe, expect, it } from "vitest";
import {
  evaluateOcrFrame,
  selectBarcodeAdjacentNumeric,
  selectProminentDisplayNumber,
  selectVerifiedPhotoOrderNumber,
  StabilityTracker,
  type NumericCandidate,
  type OcrTextBlock,
} from "./ocrPipeline";

const rules = { format: "CODE128" as const, minLength: 4, maxLength: 30 };
const labelRules = { format: "CODE128" as const, minLength: 6, maxLength: 30 };
const block = (
  text: string,
  confidence = 92,
  width = 100,
  height = 24
): OcrTextBlock => ({
  text,
  confidence,
  bbox: { x0: 0, y0: 0, x1: width, y1: height },
});
const candidate = (value: string): NumericCandidate => ({
  value,
  confidence: 92,
  area: 2400,
  bbox: { x0: 0, y0: 0, x1: 100, y1: 24 },
});

describe("OCR frame evaluation", () => {
  it("rejects mixed text instead of extracting the digits", () => {
    const decision = evaluateOcrFrame([block("ABC 12345")], rules);
    expect(decision.state).toBe("uncertain");
    expect(decision.blocks[0].reason).toBe("contains-letters");
  });

  it("rejects spaces, hyphens, and decimal points for automatic OCR capture", () => {
    expect(evaluateOcrFrame([block("12 345")], rules).blocks[0].reason).toBe(
      "contains-separators"
    );
    expect(evaluateOcrFrame([block("12-345")], rules).blocks[0].reason).toBe(
      "contains-separators"
    );
    expect(evaluateOcrFrame([block("123.45")], rules).blocks[0].reason).toBe(
      "contains-separators"
    );
  });

  it("blocks capture when multiple numeric lines are present", () => {
    const decision = evaluateOcrFrame(
      [block("12345"), block("67890", 90, 120)],
      rules
    );
    expect(decision.state).toBe("multiple");
    expect(decision.candidate).toBeUndefined();
  });

  it("uses the largest qualifying numeric line after rejecting low-confidence noise", () => {
    const decision = evaluateOcrFrame(
      [block("12345", 40, 240), block("67890", 93, 160)],
      rules
    );
    expect(decision.state).toBe("candidate");
    expect(decision.candidate?.value).toBe("67890");
    expect(decision.blocks[0].reason).toBe("low-confidence");
  });

  it("rejects low-confidence readings", () => {
    const decision = evaluateOcrFrame([block("12345", 41)], rules);
    expect(decision.state).toBe("uncertain");
    expect(decision.blocks[0].reason).toBe("low-confidence");
  });

  it("reports an invalid EAN-13 candidate without accepting it", () => {
    const decision = evaluateOcrFrame([block("4006381333932")], {
      ...rules,
      format: "EAN13",
    });
    expect(decision.state).toBe("invalid-format");
    expect(decision.blocks[0].reason).toBe("invalid-format");
  });

  it("selects only 2523517 directly below the barcode on the supplied label pattern", () => {
    const decision = selectBarcodeAdjacentNumeric(
      [
        {
          ...block("2523517", 96, 170, 28),
          bbox: { x0: 185, y0: 236, x1: 355, y1: 264 },
        },
        {
          ...block("155", 98, 65, 24),
          bbox: { x0: 420, y0: 440, x1: 485, y1: 464 },
        },
        {
          ...block("20", 98, 45, 24),
          bbox: { x0: 430, y0: 500, x1: 475, y1: 524 },
        },
        {
          ...block("2026", 98, 70, 24),
          bbox: { x0: 310, y0: 570, x1: 380, y1: 594 },
        },
      ],
      [{ x0: 110, y0: 60, x1: 430, y1: 208 }],
      labelRules
    );
    expect(decision.state).toBe("candidate");
    expect(decision.candidate?.value).toBe("2523517");
    expect(decision.blocks.find(item => item.text === "155")?.accepted).toBe(
      false
    );
    expect(decision.blocks.find(item => item.text === "20")?.accepted).toBe(
      false
    );
    expect(decision.blocks.find(item => item.text === "2026")?.accepted).toBe(
      false
    );
  });

  it("does not select a lower-label number when no numeric line sits below the barcode", () => {
    const decision = selectBarcodeAdjacentNumeric(
      [
        {
          ...block("155", 98, 65, 24),
          bbox: { x0: 420, y0: 440, x1: 485, y1: 464 },
        },
        {
          ...block("20", 98, 45, 24),
          bbox: { x0: 430, y0: 500, x1: 475, y1: 524 },
        },
      ],
      [{ x0: 110, y0: 60, x1: 430, y1: 208 }],
      labelRules
    );
    expect(decision.state).toBe("uncertain");
    expect(decision.candidate).toBeUndefined();
  });

  it("selects the long order number from a photographed screen and rejects times, counters, and status text", () => {
    const decision = selectProminentDisplayNumber(
      [
        {
          ...block("2045273896", 94, 260, 42),
          bbox: { x0: 150, y0: 230, x1: 410, y1: 272 },
        },
        {
          ...block("18:16", 97, 100, 24),
          bbox: { x0: 410, y0: 180, x1: 510, y1: 204 },
        },
        {
          ...block("1", 99, 30, 30),
          bbox: { x0: 88, y0: 88, x1: 118, y1: 118 },
        },
        {
          ...block("25", 99, 48, 26),
          bbox: { x0: 440, y0: 360, x1: 488, y1: 386 },
        },
        {
          ...block("Picked up", 95, 160, 28),
          bbox: { x0: 80, y0: 315, x1: 240, y1: 343 },
        },
      ],
      labelRules
    );
    expect(decision.state).toBe("candidate");
    expect(decision.candidate?.value).toBe("2045273896");
    expect(decision.blocks.find(item => item.text === "18:16")?.accepted).toBe(
      false
    );
    expect(decision.blocks.find(item => item.text === "1")?.accepted).toBe(
      false
    );
    expect(decision.blocks.find(item => item.text === "25")?.accepted).toBe(
      false
    );
    expect(
      decision.blocks.find(item => item.text === "Picked up")?.accepted
    ).toBe(false);
  });

  it("selects the prominent order ID from an angled screen while rejecting short UI values and watermark content", () => {
    const decision = selectProminentDisplayNumber(
      [
        {
          ...block("1900494833", 78, 310, 52),
          bbox: { x0: 120, y0: 190, x1: 430, y1: 242 },
        },
        {
          ...block("8601", 92, 105, 35),
          bbox: { x0: 130, y0: 260, x1: 235, y1: 295 },
        },
        {
          ...block("11:03 PM", 96, 138, 30),
          bbox: { x0: 16, y0: 20, x1: 154, y1: 50 },
        },
        {
          ...block("Galaxy M32", 98, 180, 36),
          bbox: { x0: 8, y0: 520, x1: 188, y1: 556 },
        },
        {
          ...block("24 August 2026 23:03", 97, 300, 38),
          bbox: { x0: 8, y0: 568, x1: 308, y1: 606 },
        },
        {
          ...block("3", 99, 18, 24),
          bbox: { x0: 110, y0: 340, x1: 128, y1: 364 },
        },
      ],
      labelRules
    );
    expect(decision.state).toBe("candidate");
    expect(decision.candidate?.value).toBe("1900494833");
    expect(decision.blocks.find(item => item.text === "8601")?.accepted).toBe(
      false
    );
    expect(
      decision.blocks.find(item => item.text === "11:03 PM")?.accepted
    ).toBe(false);
  });

  it("selects the supplied photographed-screen order ID while rejecting its time, customer number, count, and watermark", () => {
    const decision = selectProminentDisplayNumber(
      [
        {
          ...block("2075641212", 76, 410, 66),
          bbox: { x0: 320, y0: 310, x1: 730, y1: 376 },
        },
        {
          ...block("1:57 PM", 96, 112, 26),
          bbox: { x0: 46, y0: 48, x1: 158, y1: 74 },
        },
        {
          ...block("8944", 93, 98, 34),
          bbox: { x0: 270, y0: 402, x1: 368, y1: 436 },
        },
        {
          ...block("11", 98, 36, 34),
          bbox: { x0: 240, y0: 572, x1: 276, y1: 606 },
        },
        {
          ...block("25 August 2026 13:57", 96, 330, 44),
          bbox: { x0: 20, y0: 760, x1: 350, y1: 804 },
        },
        {
          ...block("Ready for pickup", 94, 250, 42),
          bbox: { x0: 650, y0: 315, x1: 900, y1: 357 },
        },
      ],
      labelRules
    );
    expect(decision.state).toBe("candidate");
    expect(decision.candidate?.value).toBe("2075641212");
    expect(decision.blocks.find(item => item.text === "8944")?.accepted).toBe(
      false
    );
    expect(decision.blocks.find(item => item.text === "11")?.accepted).toBe(
      false
    );
    expect(
      decision.blocks.find(item => item.text === "25 August 2026 13:57")
        ?.accepted
    ).toBe(false);
  });

  it("selects the reflected-screen order ID without accepting its time, customer number, count, or watermark", () => {
    const decision = selectProminentDisplayNumber(
      [
        {
          ...block("1702709887", 79, 320, 54),
          bbox: { x0: 210, y0: 282, x1: 530, y1: 336 },
        },
        {
          ...block("2:43 PM", 96, 120, 26),
          bbox: { x0: 40, y0: 66, x1: 160, y1: 92 },
        },
        {
          ...block("8961", 92, 94, 30),
          bbox: { x0: 168, y0: 370, x1: 262, y1: 400 },
        },
        {
          ...block("6", 98, 24, 26),
          bbox: { x0: 182, y0: 570, x1: 206, y1: 596 },
        },
        {
          ...block("25 August 2026 14:43", 97, 310, 40),
          bbox: { x0: 16, y0: 780, x1: 326, y1: 820 },
        },
      ],
      { ...labelRules, minLength: 8 }
    );
    expect(decision.state).toBe("candidate");
    expect(decision.candidate?.value).toBe("1702709887");
    expect(decision.blocks.find(item => item.text === "8961")?.accepted).toBe(
      false
    );
    expect(decision.blocks.find(item => item.text === "6")?.accepted).toBe(
      false
    );
  });

  it("selects the supplied reflected-screen order line despite its time, customer number, count, and payment text", () => {
    const decision = selectProminentDisplayNumber(
      [
        {
          ...block("1397357445", 88, 318, 52),
          bbox: { x0: 190, y0: 260, x1: 508, y1: 312 },
        },
        {
          ...block("4:49 PM", 96, 120, 25),
          bbox: { x0: 42, y0: 82, x1: 162, y1: 107 },
        },
        {
          ...block("9016", 94, 88, 30),
          bbox: { x0: 170, y0: 336, x1: 258, y1: 366 },
        },
        {
          ...block("9", 99, 22, 28),
          bbox: { x0: 188, y0: 470, x1: 210, y1: 498 },
        },
        {
          ...block("SAR 25.00", 94, 130, 30),
          bbox: { x0: 420, y0: 702, x1: 550, y1: 732 },
        },
      ],
      { ...labelRules, minLength: 8 }
    );
    expect(decision.state).toBe("candidate");
    expect(decision.candidate?.value).toBe("1397357445");
    expect(decision.blocks.find(item => item.text === "9016")?.accepted).toBe(
      false
    );
    expect(decision.blocks.find(item => item.text === "9")?.accepted).toBe(
      false
    );
  });

  it("allows a user-triggered corrected-angle read to use a lower-confidence isolated long order ID", () => {
    const decision = selectProminentDisplayNumber(
      [
        {
          ...block("1900494833", 32, 310, 52),
          bbox: { x0: 120, y0: 190, x1: 430, y1: 242 },
        },
        {
          ...block("8601", 92, 105, 35),
          bbox: { x0: 130, y0: 260, x1: 235, y1: 295 },
        },
        {
          ...block("23:03", 97, 100, 30),
          bbox: { x0: 16, y0: 20, x1: 116, y1: 50 },
        },
      ],
      { ...labelRules, minimumConfidence: 30 }
    );
    expect(decision.state).toBe("candidate");
    expect(decision.candidate?.value).toBe("1900494833");
  });

  it("refuses to auto-select when two competing long screen numbers are present", () => {
    const decision = selectProminentDisplayNumber(
      [
        {
          ...block("1533213815", 95, 240, 40),
          bbox: { x0: 100, y0: 180, x1: 340, y1: 220 },
        },
        {
          ...block("2045273896", 94, 230, 40),
          bbox: { x0: 110, y0: 290, x1: 340, y1: 330 },
        },
      ],
      labelRules
    );
    expect(decision.state).toBe("multiple");
    expect(decision.candidate).toBeUndefined();
  });

  it("never converts a truncated photo prefix when the complete order number is also detected", () => {
    const partial = selectProminentDisplayNumber(
      [block("138427", 91, 180, 42)],
      labelRules
    );
    const completeFirstRead = selectProminentDisplayNumber(
      [block("1384275333", 76, 310, 52)],
      { ...labelRules, minLength: 8 }
    );
    const completeSecondRead = selectProminentDisplayNumber(
      [block("1384275333", 82, 310, 52)],
      { ...labelRules, minLength: 8 }
    );
    const decision = selectVerifiedPhotoOrderNumber([
      partial,
      completeFirstRead,
      completeSecondRead,
    ]);
    expect(decision.state).toBe("candidate");
    expect(decision.candidate?.value).toBe("1384275333");
  });

  it("refuses a one-off partial photo read instead of creating a barcode", () => {
    const partial = selectProminentDisplayNumber(
      [block("138427", 91, 180, 42)],
      labelRules
    );
    const decision = selectVerifiedPhotoOrderNumber([partial]);
    expect(decision.state).toBe("uncertain");
    expect(decision.candidate).toBeUndefined();
  });

  it("refuses a photo when two different complete numbers are each verified twice", () => {
    const first = {
      state: "candidate" as const,
      detail: "First value",
      candidate: candidate("1384275333"),
      blocks: [],
    };
    const second = {
      state: "candidate" as const,
      detail: "Second value",
      candidate: candidate("2075641212"),
      blocks: [],
    };
    const decision = selectVerifiedPhotoOrderNumber([
      first,
      first,
      second,
      second,
    ]);

    expect(decision.state).toBe("multiple");
    expect(decision.candidate).toBeUndefined();
  });

  it("supports a complete four-digit handwritten return number after two local photo reads", () => {
    const first = selectProminentDisplayNumber([block("9685", 88, 160, 52)], {
      ...rules,
      minLength: 4,
    });
    const second = selectProminentDisplayNumber([block("9685", 84, 154, 50)], {
      ...rules,
      minLength: 4,
    });
    const decision = selectVerifiedPhotoOrderNumber([first, second]);
    expect(decision.state).toBe("candidate");
    expect(decision.candidate?.value).toBe("9685");
  });

  it("refuses to guess between separate handwritten numbers", () => {
    const decision = selectProminentDisplayNumber(
      [
        {
          ...block("9685", 90, 140, 48),
          bbox: { x0: 120, y0: 120, x1: 260, y1: 168 },
        },
        {
          ...block("1487", 90, 140, 48),
          bbox: { x0: 140, y0: 260, x1: 280, y1: 308 },
        },
        {
          ...block("1672", 90, 140, 48),
          bbox: { x0: 150, y0: 400, x1: 290, y1: 448 },
        },
      ],
      { ...rules, minLength: 4 }
    );
    expect(decision.state).toBe("multiple");
    expect(decision.candidate).toBeUndefined();
  });
});

describe("three-frame stability", () => {
  it("confirms only after three identical candidates", () => {
    const tracker = new StabilityTracker(3);
    expect(tracker.observe(candidate("12345"))).toEqual({
      count: 1,
      confirmed: false,
    });
    expect(tracker.observe(candidate("12345"))).toEqual({
      count: 2,
      confirmed: false,
    });
    expect(tracker.observe(candidate("12345"))).toEqual({
      count: 3,
      confirmed: true,
    });
  });

  it("resets when the reading changes or disappears", () => {
    const tracker = new StabilityTracker(3);
    tracker.observe(candidate("12345"));
    tracker.observe(candidate("12345"));
    expect(tracker.observe(candidate("67890"))).toEqual({
      count: 1,
      confirmed: false,
    });
    expect(tracker.observe()).toEqual({ count: 0, confirmed: false });
  });

  it("confirms a complete immediate-mode screen candidate from the current frame", () => {
    const tracker = new StabilityTracker(1);
    expect(tracker.observe(candidate("1397357445"))).toEqual({
      count: 1,
      confirmed: true,
    });
  });
});
