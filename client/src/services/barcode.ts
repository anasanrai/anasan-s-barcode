import JsBarcode from "jsbarcode";
import type { BarcodeFormat } from "@/services/number";

const FORMAT_MAP: Record<BarcodeFormat, string> = {
  CODE128: "CODE128",
  CODE39: "CODE39",
  EAN13: "EAN13",
};

function readCssColor(element: Element, name: string, fallback: string): string {
  const value = window.getComputedStyle(element).getPropertyValue(name).trim();
  return value || fallback;
}

/** Renders a scanner-ready barcode into the supplied SVG element. */
export function renderBarcode(
  target: SVGSVGElement,
  value: string,
  format: BarcodeFormat
): void {
  if (!value) throw new Error("Enter a number before generating a barcode.");

  const root = document.documentElement;
  const lineColor = readCssColor(root, "--barcode-line", "#101820");
  const background = readCssColor(root, "--barcode-bg", "#ffffff");
  const width = format === "CODE128" && value.length > 36 ? 1.25 : 1.8;

  JsBarcode(target, value, {
    format: FORMAT_MAP[format],
    width,
    height: 116,
    margin: 12,
    displayValue: false,
    background,
    lineColor,
    flat: true,
  });
}

/** Converts the generated SVG into a PNG download without sending it off-device. */
export async function downloadBarcodePng(
  svg: SVGSVGElement,
  filename: string
): Promise<void> {
  const viewBox = svg.viewBox.baseVal;
  const width = Math.ceil(viewBox.width || svg.getBoundingClientRect().width || 640);
  const height = Math.ceil(viewBox.height || svg.getBoundingClientRect().height || 180);
  const svgClone = svg.cloneNode(true) as SVGSVGElement;

  svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svgClone.setAttribute("width", String(width));
  svgClone.setAttribute("height", String(height));

  const serialized = new XMLSerializer().serializeToString(svgClone);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not prepare the barcode image for export."));
      image.src = url;
    });

    const scale = 3;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser cannot create a PNG export.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("Could not create the PNG file."));
      }, "image/png");
    });

    const downloadUrl = URL.createObjectURL(png);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${filename}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  } finally {
    URL.revokeObjectURL(url);
  }
}
