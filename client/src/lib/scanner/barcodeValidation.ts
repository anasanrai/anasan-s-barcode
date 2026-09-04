import type { BarcodeFormat } from "@/components/BarcodePreview";

export interface ScanRuleConfig {
  minLength?: number;
  maxLength?: number;
  exactLength?: number;
  digitsOnly?: boolean;
  prefix?: string;
  regex?: RegExp | string;
  strictGtinOnly?: boolean;
}

export const DEFAULT_SCAN_RULES: Required<Omit<ScanRuleConfig, "exactLength" | "prefix" | "regex">> & {
  exactLength?: number;
  prefix?: string;
  regex?: RegExp | string;
} = {
  minLength: 6,
  maxLength: 24,
  digitsOnly: true,
  strictGtinOnly: false,
};

/**
 * Compute the standard GS1/GTIN/EAN/UPC check digit for a string *without* the check digit.
 * Works for GTIN-8 (7+1), GTIN-12 (11+1), GTIN-13 (12+1), and GTIN-14 (13+1).
 */
export function calculateGtinCheckDigit(digitsWithoutCheck: string): number {
  let sum = 0;
  const len = digitsWithoutCheck.length;
  for (let i = 0; i < len; i++) {
    const digit = parseInt(digitsWithoutCheck[i], 10);
    if (isNaN(digit)) return -1;
    const positionFromRight = len - i;
    const weight = positionFromRight % 2 === 1 ? 3 : 1;
    sum += digit * weight;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * Validate standard GS1 / GTIN check digit.
 */
export function isValidGtinChecksum(value: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  const expectedCheck = parseInt(value.slice(-1), 10);
  const calculated = calculateGtinCheckDigit(value.slice(0, -1));
  return calculated === expectedCheck;
}

/**
 * Generic barcode string validator based on configurable rules.
 * Never converts strings to numbers, preserving all leading zeros.
 */
export function validateBarcodeString(
  value: string,
  rules: ScanRuleConfig = DEFAULT_SCAN_RULES,
): { valid: boolean; reason?: string } {
  if (!value || typeof value !== "string") {
    return { valid: false, reason: "empty value" };
  }

  const minLen = rules.minLength ?? DEFAULT_SCAN_RULES.minLength;
  const maxLen = rules.maxLength ?? DEFAULT_SCAN_RULES.maxLength;

  if (rules.digitsOnly !== false && !/^\d+$/.test(value)) {
    return { valid: false, reason: "digits only required" };
  }

  if (rules.exactLength !== undefined && value.length !== rules.exactLength) {
    return { valid: false, reason: `must be exactly ${rules.exactLength} characters` };
  }

  if (value.length < minLen) {
    return { valid: false, reason: `minimum length is ${minLen}` };
  }

  if (value.length > maxLen) {
    return { valid: false, reason: `maximum length is ${maxLen}` };
  }

  if (rules.prefix && !value.startsWith(rules.prefix)) {
    return { valid: false, reason: `must start with prefix "${rules.prefix}"` };
  }

  if (rules.regex) {
    const r = typeof rules.regex === "string" ? new RegExp(rules.regex) : rules.regex;
    if (!r.test(value)) {
      return { valid: false, reason: "does not match configured pattern" };
    }
  }

  if (rules.strictGtinOnly) {
    if (!isValidGtinChecksum(value)) {
      return { valid: false, reason: "invalid GTIN check digit" };
    }
  }

  return { valid: true };
}

/**
 * Automatically determine the best symbology format for a numeric string.
 */
export function detectBarcodeFormat(value: string): BarcodeFormat {
  const len = value.length;
  if (/^\d+$/.test(value)) {
    if (len === 14 && isValidGtinChecksum(value)) return "ITF14";
    if (len === 13 && isValidGtinChecksum(value)) return "EAN13";
    if (len === 12 && isValidGtinChecksum(value)) return "UPC";
    if (len === 8 && isValidGtinChecksum(value)) return "EAN8";
  }
  return "CODE128";
}

/**
 * Extract clean numeric targets from OCR text.
 * Preserves leading zeroes as strings.
 * Handles prefixes like "Barcode: 06287025900957", "SKU: 12345678", space-separated numbers, etc.
 */
export function extractNumericCandidate(
  ocrText: string,
  rules: ScanRuleConfig = DEFAULT_SCAN_RULES,
): string | null {
  if (!ocrText) return null;

  const minLen = rules.minLength ?? DEFAULT_SCAN_RULES.minLength;
  const maxLen = rules.maxLength ?? DEFAULT_SCAN_RULES.maxLength;

  // 1. First look for explicit labeled barcode lines: e.g. "Barcode: 06287025900957", "Item# 06281016"
  const labeledRegex = new RegExp(
    `(?:barcode|sku|upc|ean|item|code|no|#|gtin)[:\\s#]*([0-9]{${minLen},${maxLen}})`,
    "i",
  );
  const labeledMatch = ocrText.match(labeledRegex);
  if (labeledMatch && labeledMatch[1]) {
    const candidate = labeledMatch[1];
    if (validateBarcodeString(candidate, rules).valid) {
      return candidate;
    }
  }

  // 2. Normalize line breaks and spacing within digit runs (e.g. "0628 7025 9009 57" -> "06287025900957")
  let text = ocrText.replace(/\r\n/g, "\n");
  text = text.replace(/(\d)[ \t\.\-_]+(?=\d)/g, "$1");

  // 3. Normalize common OCR character confusions adjacent to digits
  const cleaned = text
    .replace(/[Oo](?=\d)/g, "0")
    .replace(/(?<=\d)[Oo]/g, "0")
    .replace(/[Il|](?=\d)/g, "1")
    .replace(/(?<=\d)[Il|]/g, "1");

  // 4. Find all candidate digit sequences matching length bounds
  const pattern = new RegExp(`\\b\\d{${minLen},${maxLen}}\\b`, "g");
  const matches = cleaned.match(pattern) || cleaned.match(new RegExp(`\\d{${minLen},${maxLen}}`, "g"));

  if (!matches || matches.length === 0) return null;

  // 5. Rank candidates:
  // - Candidates with valid GTIN checksums get highest priority (+50 bonus)
  // - Longer numbers preferred over short fragments
  let bestCandidate: string | null = null;
  let bestScore = -1;

  for (const match of matches) {
    const check = validateBarcodeString(match, rules);
    if (!check.valid) continue;

    let score = match.length;
    if (isValidGtinChecksum(match)) {
      score += 50; // Checksum bonus
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = match;
    }
  }

  return bestCandidate;
}
