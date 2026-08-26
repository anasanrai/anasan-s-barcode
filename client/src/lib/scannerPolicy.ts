import { BarcodeFormat } from "@zxing/library";
import { validateDetectedNumber } from "./number";

export type SupportedSourceFormat = "CODE_128" | "EAN_13";

export const UNSUPPORTED_BARCODE_MESSAGE =
  "Only numeric Code 128 and valid EAN-13 labels are supported. Use a supported label or enter the exact digits manually.";

export type DecodeDecision =
  | { kind: "accept"; value: string }
  | { kind: "reject"; message: string };

export function supportedSourceFormat(format: BarcodeFormat): SupportedSourceFormat | null {
  if (format === BarcodeFormat.CODE_128) return "CODE_128";
  if (format === BarcodeFormat.EAN_13) return "EAN_13";
  return null;
}

/** The only automatic barcode acceptance gate used by camera and image uploads. */
export function evaluateDecodedBarcode(candidate: string, format: BarcodeFormat): DecodeDecision {
  const sourceFormat = supportedSourceFormat(format);
  if (!sourceFormat) return { kind: "reject", message: UNSUPPORTED_BARCODE_MESSAGE };
  const validation = validateDetectedNumber(candidate, sourceFormat);
  return validation.valid
    ? { kind: "accept", value: validation.value }
    : { kind: "reject", message: validation.message };
}
