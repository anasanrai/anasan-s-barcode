export interface StoreMetrics {
  totalOrders: number;
  pickingMin: number;
  assignmentMin: number;
  fulfillmentRate: number;
  compensationRate: number;
}

export interface RankedStore extends StoreMetrics {
  id: string;
  name: string;
  branch: string;
  score: number;
  rank: number;
  top10: boolean;
}

export function calculateStoreScore(m: StoreMetrics): number {
  const pickingScore = Math.max(0, 100 - (m.pickingMin - 5) * 5);
  return (
    m.fulfillmentRate * 0.35 +
    Math.min(m.totalOrders / 15, 100) * 0.25 +
    pickingScore * 0.2 +
    (m.compensationRate / 5) * 100 * 0.2
  );
}

export function rankStores(
  stores: Array<StoreMetrics & { id: string; name: string; branch: string }>,
): RankedStore[] {
  return stores
    .map((s) => ({ ...s, score: Math.round(calculateStoreScore(s) * 10) / 10 }))
    .sort((a, b) => b.score - a.score)
    .map((s, i) => ({ ...s, rank: i + 1, top10: i < 10 }));
}

export interface PerformerMetrics {
  totalOrders: number;
  pickingTime: number;
  assignmentTime: number;
}

export function calculatePerformerScore(
  performer: PerformerMetrics,
  all: PerformerMetrics[],
): number {
  if (all.length === 0) return 0;
  const orders = all.map((p) => p.totalOrders);
  const picking = all.map((p) => (p.pickingTime > 0 ? p.pickingTime : Infinity));
  const assignment = all.map((p) => (p.assignmentTime > 0 ? p.assignmentTime : Infinity));
  const maxOrders = Math.max(...orders);
  const minPicking = Math.min(...picking.filter(Number.isFinite));
  const minAssignment = Math.min(...assignment.filter(Number.isFinite));
  const pickRatio =
    performer.pickingTime > 0 && Number.isFinite(minPicking) ? minPicking / performer.pickingTime : 0;
  const assignRatio =
    performer.assignmentTime > 0 && Number.isFinite(minAssignment)
      ? minAssignment / performer.assignmentTime
      : 0;
  const score =
    (maxOrders > 0 ? performer.totalOrders / maxOrders : 0) * 40 + pickRatio * 30 + assignRatio * 30;
  return Math.round(score * 10) / 10;
}

export type PerformerSortKey = "score" | "orders" | "picking" | "assignment";

export function sortPerformers<T extends PerformerMetrics>(
  performers: T[],
  key: PerformerSortKey,
): T[] {
  const sorted = [...performers];
  switch (key) {
    case "orders":
      sorted.sort((a, b) => b.totalOrders - a.totalOrders);
      break;
    case "picking":
      sorted.sort((a, b) => (a.pickingTime || Infinity) - (b.pickingTime || Infinity));
      break;
    case "assignment":
      sorted.sort((a, b) => (a.assignmentTime || Infinity) - (b.assignmentTime || Infinity));
      break;
    default:
      sorted.sort(
        (a, b) => calculatePerformerScore(b, performers) - calculatePerformerScore(a, performers),
      );
  }
  return sorted;
}

export function getISOWeek(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
