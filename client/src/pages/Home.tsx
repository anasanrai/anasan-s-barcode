import { useCallback, useEffect, useState } from "react";
import { Barcode, Camera } from "lucide-react";
import BarcodeGenerator from "@/components/BarcodeGenerator";
import PelicanScanner from "@/components/PelicanScanner";
import Header from "@/components/Header";
import { useNumberHistory } from "@/lib/useNumberHistory";
import { useLang } from "@/lib/i18n";

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1100 : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1099px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    setMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

type Screen = "scan" | "generate";

export default function Home() {
  const { lang } = useLang();
  const isMobile = useIsMobile();
  const [screen, setScreen] = useState<Screen>(() => {
    const qp = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("screen") : null;
    if (qp === "scan") return "scan";
    if (qp === "generate") return "generate";
    return isMobile ? "scan" : "generate";
  });
  const [detectedNumber, setDetectedNumber] = useState("");

  const { addNumber } = useNumberHistory();

  useEffect(() => {
    setScreen(isMobile ? "scan" : "generate");
  }, [isMobile]);

  const handleDetected = useCallback(
    (value: string) => {
      addNumber(value);
      setDetectedNumber(value);
      if (!isMobile) {
        setScreen("generate");
      }
    },
    [addNumber, isMobile],
  );

  const handleGoToScan = () => setScreen("scan");
  const handleGoToGenerate = () => setScreen("generate");

  /** Unified 2-tab navigation bar */
  const tabBar = (
    <div className="pelican-tabs">
      <button
        type="button"
        className={`pelican-tab ${screen === "generate" ? "pelican-tab--active" : ""}`}
        onClick={handleGoToGenerate}
      >
        <Barcode size={16} />
        <span>{lang === "ar" ? "المولد" : "Generator"}</span>
      </button>

      <button
        type="button"
        className={`pelican-tab ${screen === "scan" ? "pelican-tab--active" : ""}`}
        onClick={handleGoToScan}
      >
        <Camera size={16} />
        <span>{lang === "ar" ? "المسح" : "Scanner"}</span>
      </button>
    </div>
  );

  // Mobile layout (< 1100px)
  if (isMobile) {
    return (
      <div className="pelican-mobile-shell">
        <Header />
        <main className={`pelican-app pelican-app--${screen}`}>
          {screen === "scan" && <PelicanScanner onDetected={handleDetected} />}
          {screen === "generate" && (
            <BarcodeGenerator
              initialValue={detectedNumber}
              onOpenScanner={handleGoToScan}
            />
          )}
        </main>
        {tabBar}
      </div>
    );
  }

  // Desktop layout (>= 1100px)
  return (
    <div className="desktop-workspace">
      <Header />

      <main className="desktop-stage">
        {screen === "scan" ? (
          <div className="desktop-stage__scanner">
            <PelicanScanner onDetected={handleDetected} />
          </div>
        ) : (
          <div className="desktop-stage__generator">
            <BarcodeGenerator
              initialValue={detectedNumber}
              onOpenScanner={handleGoToScan}
            />
          </div>
        )}
      </main>

      <div className="pelican-tabs pelican-tabs--desktop">
        <button
          type="button"
          className={`pelican-tab ${screen === "generate" ? "pelican-tab--active" : ""}`}
          onClick={handleGoToGenerate}
        >
          <Barcode size={16} />
          <span>{lang === "ar" ? "المولد" : "Generator"}</span>
        </button>
        <button
          type="button"
          className={`pelican-tab ${screen === "scan" ? "pelican-tab--active" : ""}`}
          onClick={handleGoToScan}
        >
          <Camera size={16} />
          <span>{lang === "ar" ? "المسح" : "Scanner"}</span>
        </button>
      </div>
    </div>
  );
}
