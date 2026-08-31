import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";

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
  top10: boolean;
}

export interface LeaderboardData {
  week: string;
  stores: StoreLeaderboardItem[];
  performers: StarPerformer[];
}

export type { PerformerSortKey } from "@shared/scoring";
export { calculatePerformerScore, sortPerformers } from "@shared/scoring";

interface ApiStore {
  id: string;
  name: string;
  branch: string;
  rank: number;
  score: number;
  top10: boolean;
  totalOrders: number;
  pickingMin: number;
  assignmentMin: number;
  fulfillmentRate: number;
  compensationRate: number;
}

interface ApiPerformer {
  storeId: string;
  storeName: string;
  storeBranch: string;
  storeRank: number | null;
  name: string;
  role: string;
  quote: string;
  badgeTitle: string;
  photo: string | null;
}

interface ApiLeaderboard {
  week: string;
  stores: ApiStore[];
  performers: ApiPerformer[];
}

const CACHE_KEY = "hungertag_leaderboard_cache_v2";

export function badgeForRank(rank: number): string | undefined {
  if (rank === 1) return "👑 Top 1";
  if (rank === 2) return "⭐ Rank 2";
  if (rank === 3) return "🥉 Rank 3";
  return undefined;
}

export function mapApiStore(store: ApiStore): StoreLeaderboardItem {
  return {
    id: store.id,
    rank: store.rank,
    name: store.name,
    branch: store.branch,
    fulfillmentRate: store.fulfillmentRate,
    ordersCount: store.totalOrders,
    assignment: "",
    pickingTime: `${store.pickingMin} min`,
    compensationRate: store.compensationRate,
    badge: badgeForRank(store.rank),
    performanceScore: store.score,
    top10: store.top10,
  };
}

export function mapApiPerformer(performer: ApiPerformer, store: ApiStore | undefined): StarPerformer {
  return {
    id: performer.storeId,
    name: performer.name,
    role: performer.role,
    branch: performer.storeBranch,
    weekLabel: "Star of the Week",
    imageUrl: performer.photo ?? undefined,
    quote: performer.quote,
    badgeTitle: performer.badgeTitle,
    totalOrders: store?.totalOrders ?? 0,
    pickingTime: store?.pickingMin ?? 0,
    assignmentTime: store?.assignmentMin ?? 0,
  };
}

export function mapApiResponse(api: ApiLeaderboard): LeaderboardData {
  const storeById = new Map(api.stores.map((s) => [s.id, s]));
  return {
    week: api.week,
    stores: api.stores.map(mapApiStore),
    performers: api.performers.map((p) => mapApiPerformer(p, storeById.get(p.storeId))),
  };
}

export function loadCachedLeaderboard(): LeaderboardData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LeaderboardData;
    if (!parsed.week || !Array.isArray(parsed.stores)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCachedLeaderboard(data: LeaderboardData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

export function useLeaderboard() {
  const [data, setData] = useState<LeaderboardData | null>(loadCachedLeaderboard);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const api = await apiFetch<ApiLeaderboard>("/leaderboard");
      const mapped = mapApiResponse(api);
      setData(mapped);
      saveCachedLeaderboard(mapped);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    data,
    loading,
    offline,
    week: data?.week ?? "",
    starGallery: data?.performers ?? [],
    starPerformer: data?.performers[0] ?? {
      id: "",
      name: "",
      role: "",
      branch: "",
      weekLabel: "Star of the Week",
      quote: "",
      badgeTitle: "HungerStation Market",
      totalOrders: 0,
      pickingTime: 0,
      assignmentTime: 0,
    },
    topStores: data?.stores ?? [],
    refresh,
  };
}
