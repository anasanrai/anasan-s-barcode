/**
 * numericExtract.ts
 *
 * Extracts a numeric candidate from ML Kit OCR text blocks.
 * Implements temporal tracking: a number must appear in N consecutive frames
 * before it's considered confirmed.
 */

export interface NumericCandidate {
  value: string;
  streak: number;
  lastSeen: number;
}

// Minimum / maximum digit length we accept
const MIN_DIGITS = 4;
const MAX_DIGITS = 24;

// Require this many consecutive frames with the same value
export const CONFIRM_STREAK = 3;

// Streak expires if more than this many ms pass without a match
const STREAK_TIMEOUT_MS = 1500;

/**
 * Extract the best numeric candidate from raw OCR text.
 * Prefers the longest uninterrupted digit sequence in the text.
 */
export function extractNumber(ocrText: string): string | null {
  if (!ocrText || ocrText.trim().length === 0) return null;

  // Collapse whitespace
  const normalized = ocrText.replace(/\s+/g, ' ').trim();

  // Try labeled barcode patterns first: "Number: 12345", "Code: 12345", etc.
  const labeledMatch = normalized.match(
    /(?:barcode|code|number|id|order|no\.?|#)\s*[:\-]?\s*(\d{4,24})/i,
  );
  if (labeledMatch) return labeledMatch[1];

  // Find all digit sequences
  const sequences = normalized.match(/\d+/g);
  if (!sequences) return null;

  // Pick the longest that's within our range
  const valid = sequences
    .filter((s) => s.length >= MIN_DIGITS && s.length <= MAX_DIGITS)
    .sort((a, b) => b.length - a.length);

  return valid[0] ?? null;
}

/**
 * Update the running candidate tracker with a new observation.
 * Returns the confirmed number if the streak threshold is met, otherwise null.
 */
export function updateCandidate(
  current: NumericCandidate | null,
  observed: string | null,
  now: number = Date.now(),
): { candidate: NumericCandidate | null; confirmed: string | null } {
  // Expire stale candidate
  if (current && now - current.lastSeen > STREAK_TIMEOUT_MS) {
    current = null;
  }

  if (!observed) {
    // No detection this frame — do not reset immediately (be lenient)
    return { candidate: current, confirmed: null };
  }

  if (current && current.value === observed) {
    // Same number again — increment streak
    const updated: NumericCandidate = {
      value: observed,
      streak: current.streak + 1,
      lastSeen: now,
    };
    if (updated.streak >= CONFIRM_STREAK) {
      return { candidate: updated, confirmed: observed };
    }
    return { candidate: updated, confirmed: null };
  }

  // New number — start fresh
  return {
    candidate: { value: observed, streak: 1, lastSeen: now },
    confirmed: null,
  };
}
