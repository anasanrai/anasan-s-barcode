import JsBarcode from "jsbarcode";
import { Download } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

type BarcodePreviewProps = {
  value: string;
  onError: (message: string) => void;
};

export type BarcodePreviewHandle = {
  download: () => void;
};

const BarcodePreview = forwardRef<BarcodePreviewHandle, BarcodePreviewProps>(function BarcodePreview(
  { value, onError },
  ref,
) {
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!barcodeRef.current || !value) return;
    try {
      JsBarcode(barcodeRef.current, value, {
        format: "CODE128",
        lineColor: "#07111f",
        background: "#f7fbff",
        width: 2.15,
        height: 126,
        margin: 12,
        displayValue: false,
      });
      setReady(true);
    } catch {
      setReady(false);
      onError("The barcode could not be rendered. Try another number.");
    }
  }, [onError, value]);

  const download = () => {
    const svg = barcodeRef.current;
    if (!svg || !ready) {
      onError("The barcode preview is not ready to save yet.");
      return;
    }

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width * 2;
      canvas.height = image.height * 2;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#f7fbff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const link = document.createElement("a");
      link.download = `barcode-${value}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      onError("The barcode image could not be saved.");
    };
    image.src = url;
  };

  useImperativeHandle(ref, () => ({ download }));

  return (
    <div className="barcode-art" aria-label={`Code 128 barcode for ${value}`}>
      <svg ref={barcodeRef} role="img" />
      <span className="barcode-caption">{value}</span>
      <button className="download-link" type="button" onClick={download}>
        <Download size={16} /> Save PNG
      </button>
    </div>
  );
});

export default BarcodePreview;
