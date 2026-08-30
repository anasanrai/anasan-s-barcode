import { useCallback, useEffect, useState } from "react";

export interface StarPerformer {
  name: string;
  role: string;
  branch: string;
  weekLabel: string;
  imageUrl?: string;
  quote: string;
  subQuote?: string;
  badgeTitle: string;
}

export interface StoreLeaderboardItem {
  id: string;
  rank: number;
  name: string;
  branch: string;
  fulfillmentRate: number;
  ordersCount: number;
  badge?: string;
}

export interface LeaderboardState {
  starPerformer: StarPerformer;
  topStores: StoreLeaderboardItem[];
}

const STORAGE_KEY = "hungertag_leaderboard_v1";

export const DEFAULT_LEADERBOARD: LeaderboardState = {
  starPerformer: {
    name: "Azharuddin Zamir Ahmad",
    role: "Team Leader • Star Performer",
    branch: "Al Maathar Branch",
    weekLabel: "Star of the Week",
    imageUrl: "",
    quote: "Champions aren't born, they are made by hard work, focus and heart.",
    subQuote: "Thank you for your outstanding contribution!",
    badgeTitle: "HungerStation Market",
  },
  topStores: [
    { id: "1", rank: 1, name: "HungerStation Market", branch: "Al Maathar", fulfillmentRate: 99.4, ordersCount: 1420, badge: "👑 Top 1" },
    { id: "2", rank: 2, name: "HungerStation Market", branch: "Al Olaya", fulfillmentRate: 98.9, ordersCount: 1380, badge: "⭐ Rank 2" },
    { id: "3", rank: 3, name: "HungerStation Market", branch: "Al Malqa", fulfillmentRate: 98.7, ordersCount: 1290, badge: "🥉 Rank 3" },
    { id: "4", rank: 4, name: "HungerStation Market", branch: "Al Sulaimaniyah", fulfillmentRate: 98.2, ordersCount: 1210 },
    { id: "5", rank: 5, name: "HungerStation Market", branch: "Al Nakheel", fulfillmentRate: 97.9, ordersCount: 1180 },
    { id: "6", rank: 6, name: "HungerStation Market", branch: "Al Yasmin", fulfillmentRate: 97.5, ordersCount: 1140 },
    { id: "7", rank: 7, name: "HungerStation Market", branch: "Al Rawdah", fulfillmentRate: 97.1, ordersCount: 1090 },
    { id: "8", rank: 8, name: "HungerStation Market", branch: "Al Hamra", fulfillmentRate: 96.8, ordersCount: 1050 },
    { id: "9", rank: 9, name: "HungerStation Market", branch: "Al Yarmouk", fulfillmentRate: 96.5, ordersCount: 1010 },
    { id: "10", rank: 10, name: "HungerStation Market", branch: "Al Quds", fulfillmentRate: 96.2, ordersCount: 980 },
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
    topStores: data.topStores,
    updateStarPerformer,
    updateTopStores,
    resetDefaults,
  };
}
