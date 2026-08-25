import { describe, expect, it } from "vitest";
import { blocksFromOcrLines } from "./ocr";
import { selectProminentDisplayNumber } from "./ocrPipeline";

const bbox = { x0: 0, y0: 0, x1: 100, y1: 24 };

describe("screen OCR line expansion", () => {
  it("accepts an explicitly separated long order word beside a status badge without extracting digits from mixed text", () => {
    const lines = [
      {
        text: "1102885578  Picked",
        confidence: 86,
        bbox: { x0: 24, y0: 120, x1: 360, y1: 164 },
        words: [
          {
            text: "1102885578",
            confidence: 94,
            bbox: { x0: 24, y0: 120, x1: 234, y1: 164 },
          },
          {
            text: "Picked",
            confidence: 91,
            bbox: { x0: 250, y0: 120, x1: 360, y1: 164 },
          },
        ],
      },
      {
        text: "9133",
        confidence: 97,
        bbox,
      },
    ];

    expect(blocksFromOcrLines(lines).map(block => block.text)).toEqual([
      "1102885578  Picked",
      "9133",
    ]);

    const decision = selectProminentDisplayNumber(
      blocksFromOcrLines(lines, { includeSeparatedNumericWords: true }),
      { format: "CODE128", minLength: 8, maxLength: 30 }
    );

    expect(decision.state).toBe("candidate");
    expect(decision.candidate?.value).toBe("1102885578");
    expect(
      decision.blocks.find(block => block.text === "1102885578  Picked")
        ?.accepted
    ).toBe(false);
  });
});
