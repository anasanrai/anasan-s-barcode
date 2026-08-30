import QRCode from "qrcode";
import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

type Props = {
  value: string;
  onError: (message: string) => void;
};

function getQrColors(theme: "dark" | "light") {
  return theme === "dark"
    ? { dark: "#1A0F0A", light: "#FBEF00" }
    : { dark: "#1A0F0A", light: "#FFFFFF" };
}

export default function QRCodePreview({ value, onError }: Props) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [svgHtml, setSvgHtml] = useState("");
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!value) { setSvgHtml(""); return; }
    const colors = getQrColors(theme);
    QRCode.toString(value, {
      type: "svg",
      width: 280,
      margin: 2,
      color: colors,
      errorCorrectionLevel: "M",
    })
      .then((svg) => setSvgHtml(svg))
      .catch(() => onErrorRef.current("Could not generate QR code."));
  }, [value, theme]);

  const downloadPng = () => {
    if (!value) return;
    const colors = getQrColors(theme);
    const canvas = document.createElement("canvas");
    QRCode.toCanvas(canvas, value, {
      width: 560,
      margin: 4,
      color: colors,
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
        <div className="qr-placeholder">{t.typeForQr}</div>
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
