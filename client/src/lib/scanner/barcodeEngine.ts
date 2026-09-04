import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import type { BarcodeFormat } from "@/components/BarcodePreview";
import { detectBarcodeFormat, validateBarcode } from "@/lib/pelican";

export interface RenderBarcodeOptions {
  format?: BarcodeFormat;
  width?: number; // bar width multiplier (default: 2)
  height?: number; // bar height (default: 90)
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
  background?: string;
  lineColor?: string;
}

/**
 * Render a 1D barcode directly onto an HTMLCanvasElement synchronously in memory.
 */
export function renderBarcodeToCanvas(
  canvas: HTMLCanvasElement,
  value: string,
  options: RenderBarcodeOptions = {},
): boolean {
  if (!canvas || !value) return false;

  const format = options.format || detectBarcodeFormat(value);
  const jsFormat = mapFormatToJsBarcode(format);

  try {
    JsBarcode(canvas, value, {
      format: jsFormat,
      width: options.width ?? 2,
      height: options.height ?? 80,
      displayValue: options.displayValue ?? true,
      fontSize: options.fontSize ?? 16,
      margin: options.margin ?? 12,
      background: options.background ?? "#FFFFFF",
      lineColor: options.lineColor ?? "#000000",
      font: "monospace",
      textMargin: 6,
    });
    return true;
  } catch {
    // Fallback to generic CODE128 if specific symbology (e.g. ITF14) rejects input
    try {
      JsBarcode(canvas, value, {
        format: "CODE128",
        width: options.width ?? 2,
        height: options.height ?? 80,
        displayValue: options.displayValue ?? true,
        fontSize: options.fontSize ?? 16,
        margin: options.margin ?? 12,
        background: options.background ?? "#FFFFFF",
        lineColor: options.lineColor ?? "#000000",
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Render a QR code directly onto an HTMLCanvasElement
 */
export async function renderQrToCanvas(
  canvas: HTMLCanvasElement,
  value: string,
  options: { width?: number; margin?: number } = {},
): Promise<boolean> {
  if (!canvas || !value) return false;
  try {
    await QRCode.toCanvas(canvas, value, {
      width: options.width ?? 240,
      margin: options.margin ?? 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a PNG data URL for sharing/downloading
 */
export function exportBarcodeDataUrl(
  value: string,
  format?: BarcodeFormat,
): string | null {
  const canvas = document.createElement("canvas");
  const success = renderBarcodeToCanvas(canvas, value, {
    format,
    width: 3,
    height: 120,
    fontSize: 20,
    margin: 16,
  });
  return success ? canvas.toDataURL("image/png") : null;
}

function mapFormatToJsBarcode(format: BarcodeFormat): string {
  switch (format) {
    case "ITF14":
      return "ITF14";
    case "EAN13":
      return "EAN13";
    case "EAN8":
      return "EAN8";
    case "UPC":
      return "UPC";
    case "CODE39":
      return "CODE39";
    case "CODE128":
    default:
      return "CODE128";
  }
}
