import { useCallback, useEffect, useState } from "react";
import BarcodeGenerator from "@/components/BarcodeGenerator";
import InstallApp from "@/components/InstallApp";
import PelicanScanner from "@/components/PelicanScanner";
import { useNumberHistory } from "@/lib/useNumberHistory";

type Screen = "scan" | "generate" | "result";

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
  const [screen, setScreen] = useState<Screen>("generate");
  const { addNumber } = useNumberHistory();

  useEffect(() => {
    setScreen(isMobile ? "scan" : "generate");
  }, [isMobile]);

  const handleDetected = useCallback(
    (value: string) => {
      addNumber(value);
      if (isMobile) {
        setScreen("result");
      }
    },
    [addNumber, isMobile],
  );

  const handleGoToScan = () => setScreen("scan");
  const handleGoToGenerate = () => setScreen("generate");

  if (isMobile) {
    return (
      <>
        {screen === "scan" && (
          <main className="pelican-app">
            <InstallApp />
            <PelicanScanner onDetected={handleDetected} />
            <div className="pelican-tabs">
              <button type="button" className="pelican-tab pelican-tab--active">Scan</button>
              <button type="button" className="pelican-tab" onClick={handleGoToGenerate}>Generate</button>
            </div>
          </main>
        )}
        {screen === "generate" && (
          <main className="pelican-app pelican-app--generator">
            <InstallApp />
            <BarcodeGenerator onScan={handleGoToScan} />
            <div className="pelican-tabs">
              <button type="button" className="pelican-tab" onClick={handleGoToScan}>Scan</button>
              <button type="button" className="pelican-tab pelican-tab--active">Generate</button>
            </div>
          </main>
        )}
        {screen === "result" && (
          <main className="pelican-app pelican-app--generator">
            <InstallApp />
            <div className="pelican-result-placeholder">
              <p className="pelican-result-placeholder__number">{/* last detected from history */}</p>
            </div>
            <BarcodeGenerator />
            <div className="pelican-tabs">
              <button type="button" className="pelican-tab" onClick={handleGoToScan}>Scan</button>
              <button type="button" className="pelican-tab pelican-tab--active">Generate</button>
            </div>
          </main>
        )}
      </>
    );
  }

  return (
    <main className="pelican-app pelican-app--generator">
      <InstallApp />
      <BarcodeGenerator onScan={handleGoToScan} />
      <div className="pelican-tabs pelican-tabs--desktop">
        <button type="button" className="pelican-tab pelican-tab--active">Generate</button>
        <button type="button" className="pelican-tab" onClick={handleGoToScan}>Scan</button>
      </div>
    </main>
  );
}
