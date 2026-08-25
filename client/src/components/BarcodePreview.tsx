/** Signal Field design system: the barcode remains a quiet, high-contrast physical artifact with generous print-safe space. */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { renderBarcode } from "@/services/barcode";
import type { BarcodeFormat } from "@/services/number";

type BarcodePreviewProps = { value: string; format: BarcodeFormat; onError: (message: string) => void };

const BarcodePreview = forwardRef<SVGSVGElement | null, BarcodePreviewProps>(({ value, format, onError }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [rendered, setRendered] = useState(false);
  useImperativeHandle(ref, () => svgRef.current!, []);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      renderBarcode(svgRef.current, value, format);
      setRendered(true);
    } catch (error) {
      setRendered(false);
      onError(error instanceof Error ? error.message : "Unable to generate this barcode.");
    }
  }, [value, format, onError]);

  return (
    <div className="barcode-paper" aria-label={`Generated ${format} barcode for ${value}`}>
      <div className="paper-reg paper-reg-left" aria-hidden="true" />
      <svg ref={svgRef} className={`barcode-svg ${rendered ? "is-rendered" : ""}`} />
      <div className="paper-reg paper-reg-right" aria-hidden="true" />
    </div>
  );
});

BarcodePreview.displayName = "BarcodePreview";

export default BarcodePreview;
