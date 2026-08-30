import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pelican-number-history";
const MAX_HISTORY = 50;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {}
}

export function useNumberHistory() {
  const [history, setHistory] = useState<string[]>(loadHistory);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const addNumber = useCallback((num: string) => {
    setHistory((prev) => {
      const filtered = prev.filter((n) => n !== num);
      const next = [num, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const findMatch = useCallback(
    (suffix: string): string | null => {
      if (!suffix || suffix.length < 4) return null;
      return history.find((n) => n.endsWith(suffix)) ?? null;
    },
    [history],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  return { history, addNumber, findMatch, clearHistory };
}
