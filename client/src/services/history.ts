/** Signal Field design system: local-only history keeps successful conversion records concise, private, and removable. */

import type { BarcodeFormat } from "./number";

export type HistoryItem = {
  id: string;
  value: string;
  format: BarcodeFormat;
  createdAt: string;
};

const HISTORY_KEY = "number-to-barcode-history";
const SETTINGS_KEY = "number-to-barcode-settings";

export function getHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") as HistoryItem[];
  } catch {
    return [];
  }
}

export function saveHistory(item: Omit<HistoryItem, "id" | "createdAt">): HistoryItem[] {
  const next = [{ ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...getHistory()].slice(0, 30);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function removeHistory(id: string): HistoryItem[] {
  const next = getHistory().filter((item) => item.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

export function getSettings<T>(fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return fallback;
  }
}

export function saveSettings<T>(settings: T): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
