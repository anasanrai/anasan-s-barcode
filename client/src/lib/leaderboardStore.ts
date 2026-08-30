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

export function loadLeaderboardData(): LeaderboardState {
  if (typeof window === "undefined") return DEFAULT_LEADERBOARD;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LEADERBOARD;
    const parsed = JSON.parse(raw) as LeaderboardState;
    return {
      starPerformer: { ...DEFAULT_LEADERBOARD.starPerformer, ...parsed.starPerformer },
      starGallery: Array.isArray(parsed.starGallery) && parsed.starGallery.length > 0
        ? parsed.starGallery
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
