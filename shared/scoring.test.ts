import { describe, expect, it } from "vitest";
import {
  calculatePerformerScore,
  calculateStoreScore,
  getISOWeek,
  rankStores,
  sortPerformers,
} from "./scoring";

describe("calculateStoreScore", () => {
  it("scores stronger stores higher", () => {
    const strong = { totalOrders: 1500, pickingMin: 8, assignmentMin: 2, fulfillmentRate: 99.4, compensationRate: 4.8 };
    const weak = { totalOrders: 500, pickingMin: 20, assignmentMin: 10, fulfillmentRate: 90, compensationRate: 2 };
    expect(calculateStoreScore(strong)).toBeGreaterThan(calculateStoreScore(weak));
  });

  it("never returns NaN for zeroed metrics", () => {
    const zeroed = { totalOrders: 0, pickingMin: 0, assignmentMin: 0, fulfillmentRate: 0, compensationRate: 0 };
    expect(Number.isFinite(calculateStoreScore(zeroed))).toBe(true);
  });
});

describe("rankStores", () => {
  const stores = [
    { id: "a", name: "A", branch: "B1", totalOrders: 100, pickingMin: 10, assignmentMin: 5, fulfillmentRate: 98, compensationRate: 4 },
    { id: "b", name: "B", branch: "B", totalOrders: 300, pickingMin: 6, assignmentMin: 1, fulfillmentRate: 99.9, compensationRate: 5 },
    { id: "c", name: "C", branch: "B", totalOrders: 200, pickingMin: 10, assignmentMin: 3, fulfillmentRate: 97, compensationRate: 4.5 },
  ];

  it("ranks by score descending and assigns sequential ranks", () => {
    const ranked = rankStores(stores);
    expect(ranked[0].id).toBe("b");
    expect(ranked.map((s) => s.rank)).toEqual([1, 2, 3]);
  });

  it("marks only the top 10 as top10", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      id: `s${i}`,
      name: `Store ${i}`,
      branch: "B",
      totalOrders: 100 - i,
      pickingMin: 10,
      assignmentMin: 5,
      fulfillmentRate: 95,
      compensationRate: 4,
    }));
    const ranked = rankStores(many);
    expect(ranked.filter((s) => s.top10).length).toBe(10);
    expect(ranked[9].rank).toBe(10);
    expect(ranked[10].top10).toBe(false);
  });

  it("does not mutate the input", () => {
    const copy = JSON.parse(JSON.stringify(stores));
    rankStores(stores);
    expect(stores).toEqual(copy);
  });
});

describe("getISOWeek", () => {
  it("returns ISO week for a known date (2026-01-01 is week 1)", () => {
    expect(getISOWeek(new Date(Date.UTC(2026, 0, 1)))).toBe("2026-W01");
  });

  it("handles year-boundary weeks", () => {
    expect(getISOWeek(new Date(Date.UTC(2024, 11, 30)))).toBe("2025-W01");
    expect(getISOWeek(new Date(Date.UTC(2021, 0, 1)))).toBe("2020-W53");
  });

  it("matches the YYYY-Wnn format", () => {
    expect(getISOWeek()).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe("performer scoring", () => {
  it("rewards faster picking and assignment", () => {
    const fast = { totalOrders: 100, pickingTime: 5, assignmentTime: 2 };
    const slow = { totalOrders: 100, pickingTime: 15, assignmentTime: 8 };
    expect(calculatePerformerScore(fast, [fast, slow])).toBeGreaterThan(
      calculatePerformerScore(slow, [fast, slow]),
    );
  });

  it("sorts by score without mutating input", () => {
    const list = [
      { id: "a", totalOrders: 100, pickingTime: 10, assignmentTime: 5 },
      { id: "b", totalOrders: 200, pickingTime: 12, assignmentTime: 9 },
    ];
    const sorted = sortPerformers(list, "score");
    expect(sorted[0].totalOrders).toBe(200);
    expect(list[0].totalOrders).toBe(100);
  });
});
