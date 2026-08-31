import { describe, expect, it } from "vitest";
import {
  badgeForRank,
  calculatePerformerScore,
  mapApiPerformer,
  mapApiResponse,
  mapApiStore,
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

describe("api mapping", () => {
  it("derives badges from rank", () => {
    expect(badgeForRank(1)).toBe("👑 Top 1");
    expect(badgeForRank(2)).toBe("⭐ Rank 2");
    expect(badgeForRank(3)).toBe("🥉 Rank 3");
    expect(badgeForRank(4)).toBeUndefined();
  });

  it("maps api store to leaderboard item", () => {
    const item = mapApiStore({
      id: "s1", name: "Store", branch: "B", rank: 1, score: 94.7, top10: true,
      totalOrders: 1420, pickingMin: 8, assignmentMin: 2, fulfillmentRate: 99.4, compensationRate: 4.8,
    });
    expect(item.rank).toBe(1);
    expect(item.ordersCount).toBe(1420);
    expect(item.pickingTime).toBe("8 min");
    expect(item.badge).toBe("👑 Top 1");
    expect(item.top10).toBe(true);
  });

  it("maps performer with parent store metrics", () => {
    const p = mapApiPerformer(
      { storeId: "s1", storeName: "Store", storeBranch: "B", storeRank: 1, name: "Ahmad", role: "Shopper", quote: "Go", badgeTitle: "HS", photo: null },
      { id: "s1", name: "Store", branch: "B", rank: 1, score: 90, top10: true, totalOrders: 1000, pickingMin: 9, assignmentMin: 3, fulfillmentRate: 98, compensationRate: 4 },
    );
    expect(p.id).toBe("s1");
    expect(p.totalOrders).toBe(1000);
    expect(p.pickingTime).toBe(9);
    expect(p.imageUrl).toBeUndefined();
  });

  it("round-trips full api response", () => {
    const api = {
      week: "2026-W36",
      stores: [{ id: "s1", name: "Store", branch: "B", rank: 1, score: 90, top10: true, totalOrders: 1000, pickingMin: 9, assignmentMin: 3, fulfillmentRate: 98, compensationRate: 4 }],
      performers: [{ storeId: "s1", storeName: "Store", storeBranch: "B", storeRank: 1, name: "Ahmad", role: "Shopper", quote: "", badgeTitle: "HS", photo: "data:image/jpeg;base64,x" }],
    };
    const mapped = mapApiResponse(api);
    expect(mapped.week).toBe("2026-W36");
    expect(mapped.stores.length).toBe(1);
    expect(mapped.performers[0].imageUrl).toBe("data:image/jpeg;base64,x");
    expect(mapped.performers[0].totalOrders).toBe(1000);
  });
});
