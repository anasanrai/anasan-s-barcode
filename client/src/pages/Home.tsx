import { useCallback, useEffect, useState } from "react";
import BarcodeGenerator from "@/components/BarcodeGenerator";
import PelicanScanner from "@/components/PelicanScanner";
import Header from "@/components/Header";
import { useNumberHistory } from "@/lib/useNumberHistory";

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    setMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

export default function Home() {
  const isMobile = useIsMobile();
  const [screen, setScreen] = useState<"scan" | "generate">("generate");
  const [detectedNumber, setDetectedNumber] = useState("");
  const { addNumber } = useNumberHistory();

  useEffect(() => {
    setScreen(isMobile ? "scan" : "generate");
  }, [isMobile]);

  const handleDetected = useCallback(
    (value: string) => {
      addNumber(value);
      setDetectedNumber(value);
      setScreen("generate");
    },
    [addNumber],
  );

  const handleGoToScan = () => {
    setScreen("scan");
  };
  const handleGoToGenerate = () => setScreen("generate");

  if (isMobile) {
    return (
      <>
        {screen === "scan" && (
          <main className="pelican-app">
            <PelicanScanner onDetected={handleDetected} />
            <div className="pelican-tabs">
              <button type="button" className="pelican-tab pelican-tab--active">Scan</button>
              <button type="button" className="pelican-tab" onClick={handleGoToGenerate}>Generate</button>
            </div>
          </main>
        )}
        {screen === "generate" && (
          <main className="pelican-app pelican-app--generator">
            <Header />
            <BarcodeGenerator initialValue={detectedNumber} onScan={handleGoToScan} />
            <div className="pelican-tabs">
              <button type="button" className="pelican-tab" onClick={handleGoToScan}>Scan</button>
              <button type="button" className="pelican-tab pelican-tab--active">Generate</button>
            </div>
          </main>
        )}
      </>
    );
  }

  if (screen === "scan") {
    return (
      <main className="pelican-app">
        <Header />
        <PelicanScanner onDetected={handleDetected} />
        <div className="pelican-tabs pelican-tabs--desktop">
          <button type="button" className="pelican-tab" onClick={handleGoToGenerate}>Generate</button>
          <button type="button" className="pelican-tab pelican-tab--active">Scan</button>
        </div>
      </main>
    );
  }

  return (
    <main className="pelican-app pelican-app--generator">
      <Header />
      <BarcodeGenerator initialValue={detectedNumber} onScan={handleGoToScan} />
      <div className="pelican-tabs pelican-tabs--desktop">
        <button type="button" className="pelican-tab pelican-tab--active">Generate</button>
        <button type="button" className="pelican-tab" onClick={handleGoToScan}>Scan</button>
      </div>
    </main>
  );
}
