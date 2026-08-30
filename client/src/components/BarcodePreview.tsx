import JsBarcode from "jsbarcode";
import { Download, Check, X } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type BarcodeFormat = "CODE128" | "EAN13" | "EAN8" | "UPC" | "CODE39" | "ITF14";

type BarcodePreviewProps = {
  value: string;
  format?: BarcodeFormat;
  onError: (message: string) => void;
  onValid?: (valid: boolean) => void;
  lineColor?: string;
  background?: string;
  width?: number;
  height?: number;
};

export type BarcodePreviewHandle = {
  download: () => void;
  downloadSvg: () => void;
  getSvgElement: () => SVGSVGElement | null;
};

const FORMAT_CONFIG: Record<BarcodeFormat, { label: string; pattern: RegExp; description: string }> = {
  CODE128: { label: "CODE128", pattern: /^[\x00-\x7F]+$/, description: "Any ASCII text" },
  EAN13: { label: "EAN-13", pattern: /^\d{12,13}$/, description: "12 or 13 digits" },
  EAN8: { label: "EAN-8", pattern: /^\d{7,8}$/, description: "7 or 8 digits" },
  UPC: { label: "UPC-A", pattern: /^\d{11,12}$/, description: "11 or 12 digits" },
  CODE39: { label: "CODE39", pattern: /^[A-Z0-9\-\.\ \$\/\+\%]+$/, description: "A-Z, 0-9, -.$/+%" },
  ITF14: { label: "ITF-14", pattern: /^\d{13,14}$/, description: "13 or 14 digits" },
};

const BarcodePreview = forwardRef<BarcodePreviewHandle, BarcodePreviewProps>(function BarcodePreview(
  { value, format = "CODE128", onError, onValid, lineColor, background, width, height },
  ref,
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format,
        lineColor: lineColor ?? "#1A0F0A",
        background: background ?? "#FBEF00",
        width: width ?? 2.15,
        height: height ?? 126,
        margin: 12,
        displayValue: false,
        valid: (isValid: boolean) => {
          setValid(isValid);
          onValid?.(isValid);
        },
      });
      if (!valid) {
        onError(`Invalid ${FORMAT_CONFIG[format].label} value.`);
      }
    } catch {
      setValid(false);
      onValid?.(false);
      onError(`Invalid ${FORMAT_CONFIG[format].label} value.`);
    }
  }, [value, format, lineColor, background, width, height, onError, onValid, valid]);

  const download = () => {
    const svg = svgRef.current;
    if (!svg || !valid) { onError("Barcode not ready."); return; }
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width * 2;
      canvas.height = image.height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = background ?? "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const link = document.createElement("a");
      link.download = `barcode-${value}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    image.onerror = () => { URL.revokeObjectURL(url); onError("Could not save barcode."); };
    image.src = url;
  };

  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg || !valid) { onError("Barcode not ready."); return; }
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `barcode-${value}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  useImperativeHandle(ref, () => ({ download, downloadSvg, getSvgElement: () => svgRef.current }));

  return (
    <div className="barcode-art" aria-label={`${FORMAT_CONFIG[format].label} barcode for ${value}`}>
      <svg ref={svgRef} role="img" />
      <div className="barcode-meta">
        <span className="barcode-caption">{value}</span>
        {valid !== null && (
          <span className={`barcode-validity ${valid ? "barcode-validity--ok" : "barcode-validity--err"}`}>
            {valid ? <Check size={12} /> : <X size={12} />}
            {valid ? FORMAT_CONFIG[format].label : "Invalid"}
          </span>
        )}
      </div>
      <div className="barcode-actions">
        <button className="barcode-download" type="button" onClick={download}>
          <Download size={14} /> PNG
        </button>
        <button className="barcode-download" type="button" onClick={downloadSvg}>
          <Download size={14} /> SVG
        </button>
      </div>
    </div>
  );
});

export default BarcodePreview;
export { FORMAT_CONFIG };
