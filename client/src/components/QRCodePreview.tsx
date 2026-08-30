import QRCode from "qrcode";
import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onError: (message: string) => void;
};

export default function QRCodePreview({ value, onError }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [svgHtml, setSvgHtml] = useState("");

  useEffect(() => {
    if (!value) { setSvgHtml(""); return; }
    QRCode.toString(value, {
      type: "svg",
      width: 280,
      margin: 2,
      color: { dark: "#07111f", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((svg) => setSvgHtml(svg))
      .catch(() => onError("Could not generate QR code."));
  }, [value, onError]);

  const downloadPng = () => {
    if (!value) return;
    const canvas = document.createElement("canvas");
    QRCode.toCanvas(canvas, value, {
      width: 560,
      margin: 4,
      color: { dark: "#07111f", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(() => {
        const link = document.createElement("a");
        link.download = `qr-${value}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      })
      .catch(() => onError("Could not save QR code."));
  };

  const downloadSvg = () => {
    if (!svgHtml) return;
    const blob = new Blob([svgHtml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `qr-${value}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="qr-art">
      {svgHtml ? (
        <div ref={(el) => { if (el) el.innerHTML = svgHtml; }} className="qr-svg-wrap" />
      ) : (
        <div className="qr-placeholder">Type something to generate QR</div>
      )}
      {svgHtml && (
        <>
          <div className="barcode-meta">
            <span className="barcode-caption">{value}</span>
          </div>
          <div className="barcode-actions">
            <button className="barcode-download" type="button" onClick={downloadPng}>
              <Download size={14} /> PNG
            </button>
            <button className="barcode-download" type="button" onClick={downloadSvg}>
              <Download size={14} /> SVG
            </button>
          </div>
        </>
      )}
    </div>
  );
}
