import { describe, expect, it } from "vitest";
import {
  calculatePerformerScore,
  sortPerformers,
  type StarPerformer,
} from "./leaderboardStore";

const performer = (overrides: Partial<StarPerformer>): StarPerformer => ({
  id: "x",
  name: "Test",
  role: "Shopper",
  branch: "Branch",
  weekLabel: "Star of the Week",
  quote: "",
  badgeTitle: "HungerStation Market",
  totalOrders: 0,
  pickingTime: 0,
  assignmentTime: 0,
  ...overrides,
});

describe("calculatePerformerScore", () => {
  it("gives the max-orders performer the full order component", () => {
    const a = performer({ id: "a", totalOrders: 100, pickingTime: 10, assignmentTime: 5 });
    const b = performer({ id: "b", totalOrders: 50, pickingTime: 10, assignmentTime: 5 });
    expect(calculatePerformerScore(a, [a, b])).toBeGreaterThan(calculatePerformerScore(b, [a, b]));
  });

  it("rewards faster picking and assignment times", () => {
    const fast = performer({ id: "fast", totalOrders: 100, pickingTime: 5, assignmentTime: 2 });
    const slow = performer({ id: "slow", totalOrders: 100, pickingTime: 15, assignmentTime: 8 });
    expect(calculatePerformerScore(fast, [fast, slow])).toBeGreaterThan(
      calculatePerformerScore(slow, [fast, slow]),
    );
  });

  it("returns 0 for an empty list", () => {
    const a = performer({});
    expect(calculatePerformerScore(a, [])).toBe(0);
  });

  it("handles performers with zero times without NaN", () => {
    const a = performer({ id: "a", totalOrders: 100, pickingTime: 0, assignmentTime: 0 });
    const b = performer({ id: "b", totalOrders: 50, pickingTime: 10, assignmentTime: 5 });
    const score = calculatePerformerScore(a, [a, b]);
    expect(Number.isFinite(score)).toBe(true);
  });
});

describe("sortPerformers", () => {
  const list = [
    performer({ id: "a", totalOrders: 100, pickingTime: 10, assignmentTime: 5 }),
    performer({ id: "b", totalOrders: 200, pickingTime: 12, assignmentTime: 9 }),
    performer({ id: "c", totalOrders: 50, pickingTime: 6, assignmentTime: 2 }),
  ];

  it("sorts by orders descending", () => {
    expect(sortPerformers(list, "orders").map((p) => p.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by picking time ascending", () => {
    expect(sortPerformers(list, "picking").map((p) => p.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by assignment time ascending", () => {
    expect(sortPerformers(list, "assignment").map((p) => p.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by overall score by default", () => {
    const sorted = sortPerformers(list, "score");
    const scores = sorted.map((p) => calculatePerformerScore(p, list));
    expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
    expect(scores[1]).toBeGreaterThanOrEqual(scores[2]);
  });

  it("does not mutate the input array", () => {
    const copy = [...list];
    sortPerformers(list, "orders");
    expect(list).toEqual(copy);
  });

  it("treats zero times as slowest", () => {
    const zeroed = performer({ id: "z", totalOrders: 100, pickingTime: 0, assignmentTime: 0 });
    const timed = performer({ id: "t", totalOrders: 100, pickingTime: 10, assignmentTime: 5 });
    expect(sortPerformers([zeroed, timed], "picking").map((p) => p.id)).toEqual(["t", "z"]);
    expect(sortPerformers([zeroed, timed], "assignment").map((p) => p.id)).toEqual(["t", "z"]);
  });
});
