/** Signal Field design system: high-contrast SVG output preserves readable quiet zones for physical scanning. */

import JsBarcode from "jsbarcode";
import { barcodeValue, type BarcodeFormat } from "./number";

export function renderBarcode(
  target: SVGSVGElement,
  value: string,
  format: BarcodeFormat,
): void {
  const encoded = barcodeValue(value, format);
  JsBarcode(target, encoded, {
    format,
    lineColor: "#101312",
    background: "#FCFCF5",
    width: format === "EAN13" ? 2.45 : encoded.length > 30 ? 2.1 : 2.55,
    height: 132,
    displayValue: true,
    font: "IBM Plex Mono, monospace",
    fontSize: 17,
    textMargin: 14,
    margin: 30,
    marginTop: 28,
    marginBottom: 28,
    flat: true,
    valid: (valid) => {
      if (!valid) throw new Error("This value cannot be encoded in the selected barcode format.");
    },
  });
}

export async function downloadBarcodePng(svg: SVGSVGElement, filename: string): Promise<void> {
  const markup = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const source = URL.createObjectURL(svgBlob);
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to prepare a PNG export."));
    image.src = source;
  });

  const canvas = document.createElement("canvas");
  const scale = 4;
  canvas.width = image.width * scale;
  canvas.height = image.height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser cannot create a PNG export.");
  context.fillStyle = "#FCFCF5";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(source);

  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) throw new Error("Unable to create PNG export.");
  triggerDownload(URL.createObjectURL(png), `${filename}.png`);
}

export function downloadBarcodeSvg(svg: SVGSVGElement, filename: string): void {
  const markup = new XMLSerializer().serializeToString(svg);
  triggerDownload(URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" })), `${filename}.svg`);
}

function triggerDownload(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}
