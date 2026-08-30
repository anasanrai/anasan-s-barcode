import { useCallback, useEffect, useState } from "react";

export interface StarPerformer {
  id: string;
  name: string;
  role: string;
  branch: string;
  weekLabel: string;
  imageUrl?: string;
  quote: string;
  badgeTitle: string;
  totalOrders: number;
  pickingTime: number;
  assignmentTime: number;
}

export type PerformerSortKey = "score" | "orders" | "picking" | "assignment";

export interface StoreLeaderboardItem {
  id: string;
  rank: number;
  name: string;
  branch: string;
  fulfillmentRate: number;
  ordersCount: number;
  assignment: string;
  pickingTime: string;
  compensationRate: number;
  badge?: string;
  performanceScore?: number;
}

export interface LeaderboardState {
  starPerformer: StarPerformer;
  starGallery: StarPerformer[];
  topStores: StoreLeaderboardItem[];
}

const STORAGE_KEY = "hungertag_leaderboard_v1";

const DEFAULT_STAR: StarPerformer = {
  id: "star-1",
  name: "Azharuddin Zamir Ahmad",
  role: "Team Leader • Star Performer",
  branch: "Al Maathar Branch",
  weekLabel: "Star of the Week",
  imageUrl: "",
  quote: "Champions aren't born, they are made by hard work, focus and heart.",
  badgeTitle: "HungerStation Market",
  totalOrders: 1420,
  pickingTime: 8,
  assignmentTime: 2,
};

export const DEFAULT_LEADERBOARD: LeaderboardState = {
  starPerformer: DEFAULT_STAR,
  starGallery: [DEFAULT_STAR],
  topStores: [
    { id: "1", rank: 1, name: "HungerStation Market", branch: "Al Maathar", fulfillmentRate: 99.4, ordersCount: 1420, assignment: "Front Store", pickingTime: "8 min", compensationRate: 4.8, badge: "👑 Top 1" },
    { id: "2", rank: 2, name: "HungerStation Market", branch: "Al Olaya", fulfillmentRate: 98.9, ordersCount: 1380, assignment: "Warehouse", pickingTime: "9 min", compensationRate: 4.7, badge: "⭐ Rank 2" },
    { id: "3", rank: 3, name: "HungerStation Market", branch: "Al Malqa", fulfillmentRate: 98.7, ordersCount: 1290, assignment: "Front Store", pickingTime: "10 min", compensationRate: 4.6, badge: "🥉 Rank 3" },
    { id: "4", rank: 4, name: "HungerStation Market", branch: "Al Sulaimaniyah", fulfillmentRate: 98.2, ordersCount: 1210, assignment: "Warehouse", pickingTime: "10 min", compensationRate: 4.5 },
    { id: "5", rank: 5, name: "HungerStation Market", branch: "Al Nakheel", fulfillmentRate: 97.9, ordersCount: 1180, assignment: "Front Store", pickingTime: "11 min", compensationRate: 4.4 },
    { id: "6", rank: 6, name: "HungerStation Market", branch: "Al Yasmin", fulfillmentRate: 97.5, ordersCount: 1140, assignment: "Warehouse", pickingTime: "11 min", compensationRate: 4.4 },
    { id: "7", rank: 7, name: "HungerStation Market", branch: "Al Rawdah", fulfillmentRate: 97.1, ordersCount: 1090, assignment: "Front Store", pickingTime: "12 min", compensationRate: 4.3 },
    { id: "8", rank: 8, name: "HungerStation Market", branch: "Al Hamra", fulfillmentRate: 96.8, ordersCount: 1050, assignment: "Warehouse", pickingTime: "12 min", compensationRate: 4.2 },
    { id: "9", rank: 9, name: "HungerStation Market", branch: "Al Yarmouk", fulfillmentRate: 96.5, ordersCount: 1010, assignment: "Front Store", pickingTime: "13 min", compensationRate: 4.1 },
    { id: "10", rank: 10, name: "HungerStation Market", branch: "Al Quds", fulfillmentRate: 96.2, ordersCount: 980, assignment: "Warehouse", pickingTime: "13 min", compensationRate: 4.0 },
  ],
};

export function calculatePerformanceScore(store: StoreLeaderboardItem): number {
  const pickingMinutes = parseFloat(store.pickingTime) || 10;
  const pickingScore = Math.max(0, 100 - (pickingMinutes - 5) * 5);
  return (
    store.fulfillmentRate * 0.35 +
    Math.min(store.ordersCount / 15, 100) * 0.25 +
    pickingScore * 0.2 +
    (store.compensationRate / 5) * 100 * 0.2
  );
}

export function sortByPerformance(stores: StoreLeaderboardItem[]): StoreLeaderboardItem[] {
  return stores
    .map((s) => ({ ...s, performanceScore: calculatePerformanceScore(s) }))
    .sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0))
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export function calculatePerformerScore(performer: StarPerformer, all: StarPerformer[]): number {
  if (all.length === 0) return 0;
  const orders = all.map((p) => p.totalOrders);
  const picking = all.map((p) => (p.pickingTime > 0 ? p.pickingTime : Infinity));
  const assignment = all.map((p) => (p.assignmentTime > 0 ? p.assignmentTime : Infinity));
  const maxOrders = Math.max(...orders);
  const minPicking = Math.min(...picking.filter(Number.isFinite));
  const minAssignment = Math.min(...assignment.filter(Number.isFinite));
  const pickBest = (p: StarPerformer) => {
    if (p.pickingTime > 0 && Number.isFinite(minPicking)) return minPicking / p.pickingTime;
    return 0;
  };
  const assignBest = (p: StarPerformer) => {
    if (p.assignmentTime > 0 && Number.isFinite(minAssignment)) return minAssignment / p.assignmentTime;
    return 0;
  };
  const score =
    (maxOrders > 0 ? performer.totalOrders / maxOrders : 0) * 40 +
    pickBest(performer) * 30 +
    assignBest(performer) * 30;
  return Math.round(score * 10) / 10;
}

export function sortPerformers(performers: StarPerformer[], key: PerformerSortKey): StarPerformer[] {
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

export function loadLeaderboardData(): LeaderboardState {
  if (typeof window === "undefined") return DEFAULT_LEADERBOARD;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LEADERBOARD;
    const parsed = JSON.parse(raw) as LeaderboardState;
    const withDefaults = (p: Partial<StarPerformer>): StarPerformer => ({
      ...DEFAULT_STAR,
      ...p,
      totalOrders: Number(p.totalOrders) || 0,
      pickingTime: Number(p.pickingTime) || 0,
      assignmentTime: Number(p.assignmentTime) || 0,
    });
    return {
      starPerformer: withDefaults({ ...DEFAULT_LEADERBOARD.starPerformer, ...parsed.starPerformer }),
      starGallery: Array.isArray(parsed.starGallery) && parsed.starGallery.length > 0
        ? parsed.starGallery.map(withDefaults)
        : DEFAULT_LEADERBOARD.starGallery,
      topStores: Array.isArray(parsed.topStores) && parsed.topStores.length > 0 ? parsed.topStores : DEFAULT_LEADERBOARD.topStores,
    };
  } catch {
    return DEFAULT_LEADERBOARD;
  }
}

export function saveLeaderboardData(data: LeaderboardState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("leaderboard-updated"));
  } catch {}
}

export function useLeaderboard() {
  const [data, setData] = useState<LeaderboardState>(loadLeaderboardData);

  useEffect(() => {
    const update = () => setData(loadLeaderboardData());
    window.addEventListener("leaderboard-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("leaderboard-updated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const updateStarPerformer = useCallback((performer: Partial<StarPerformer>) => {
    setData((prev) => {
      const next: LeaderboardState = {
        ...prev,
        starPerformer: { ...prev.starPerformer, ...performer },
      };
      saveLeaderboardData(next);
      return next;
    });
  }, []);

  const updateStarGallery = useCallback((gallery: StarPerformer[]) => {
    setData((prev) => {
      const next: LeaderboardState = { ...prev, starGallery: gallery };
      saveLeaderboardData(next);
      return next;
    });
  }, []);

  const updateTopStores = useCallback((stores: StoreLeaderboardItem[]) => {
    setData((prev) => {
      const next: LeaderboardState = {
        ...prev,
        topStores: stores,
      };
      saveLeaderboardData(next);
      return next;
    });
  }, []);

  const resetDefaults = useCallback(() => {
    setData(DEFAULT_LEADERBOARD);
    saveLeaderboardData(DEFAULT_LEADERBOARD);
  }, []);

  return {
    data,
    starPerformer: data.starPerformer,
    starGallery: data.starGallery,
    topStores: data.topStores,
    updateStarPerformer,
    updateStarGallery,
    updateTopStores,
    resetDefaults,
  };
}
