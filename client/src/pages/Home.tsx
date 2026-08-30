import { useCallback, useEffect, useState } from "react";
import BarcodeGenerator from "@/components/BarcodeGenerator";
import PelicanScanner from "@/components/PelicanScanner";
import Header from "@/components/Header";
import StarPerformerCard from "@/components/StarPerformerCard";
import TopStoresLeaderboard from "@/components/TopStoresLeaderboard";
import LeaderboardModal from "@/components/LeaderboardModal";
import AdminPage from "./AdminPage";
import { useNumberHistory } from "@/lib/useNumberHistory";
import { useLeaderboard } from "@/lib/leaderboardStore";

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

export default function Home() {
  const isMobile = useIsMobile();
  const [screen, setScreen] = useState<"scan" | "generate">("generate");
  const [view, setView] = useState<"app" | "admin">(() => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
      return "admin";
    }
    return "app";
  });
  const [detectedNumber, setDetectedNumber] = useState("");
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  const { addNumber } = useNumberHistory();
  const { starPerformer, topStores } = useLeaderboard();

  useEffect(() => {
    setScreen(isMobile ? "scan" : "generate");
  }, [isMobile]);

  // Listen for browser popstate / back button
  useEffect(() => {
    const onPop = () => {
      if (window.location.pathname.startsWith("/admin")) {
        setView("admin");
      } else {
        setView("app");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleDetected = useCallback(
    (value: string) => {
      addNumber(value);
      setDetectedNumber(value);
    },
    [addNumber],
  );

  const handleGoToScan = () => setScreen("scan");
  const handleGoToGenerate = () => setScreen("generate");

  const handleOpenAdmin = () => {
    window.history.pushState({}, "", "/admin");
    setView("admin");
  };

  const handleCloseAdmin = () => {
    window.history.pushState({}, "", "/");
    setView("app");
  };

  if (view === "admin") {
    return <AdminPage onBack={handleCloseAdmin} />;
  }

  // Mobile layout (< 1100px)
  if (isMobile) {
    return (
      <>
        {screen === "scan" && (
          <main className="pelican-app">
            <Header
              onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
              onGoToAdmin={handleOpenAdmin}
            />
            <PelicanScanner onDetected={handleDetected} />
            <div className="pelican-tabs">
              <button type="button" className="pelican-tab pelican-tab--active">
                Scan
              </button>
              <button type="button" className="pelican-tab" onClick={handleGoToGenerate}>
                Generate
              </button>
            </div>
          </main>
        )}

        {screen === "generate" && (
          <main className="pelican-app pelican-app--generator">
            <Header
              onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
              onGoToAdmin={handleOpenAdmin}
            />
            <BarcodeGenerator initialValue={detectedNumber} />
            <div className="pelican-tabs">
              <button type="button" className="pelican-tab" onClick={handleGoToScan}>
                Scan
              </button>
              <button type="button" className="pelican-tab pelican-tab--active">
                Generate
              </button>
            </div>
          </main>
        )}

        {/* Mobile Leaderboard Sheet Modal */}
        <LeaderboardModal
          isOpen={isLeaderboardOpen}
          onClose={() => setIsLeaderboardOpen(false)}
        />
      </>
    );
  }

  // Desktop layout (>= 1100px): 3-column layout
  return (
    <div className="desktop-workspace">
      <Header onGoToAdmin={handleOpenAdmin} />

      <div className="desktop-layout">
        {/* Left Column: Star Performer of the Week */}
        <div className="desktop-layout__left">
          <StarPerformerCard performer={starPerformer} />
        </div>

        {/* Center Column: Scanner or Generator */}
        <main className="desktop-layout__center">
          {screen === "scan" ? (
            <div className="desktop-scanner-frame">
              <PelicanScanner onDetected={handleDetected} />
            </div>
          ) : (
            <div className="desktop-generator-frame">
              <BarcodeGenerator initialValue={detectedNumber} />
            </div>
          )}

          <div className="pelican-tabs pelican-tabs--desktop">
            <button
              type="button"
              className={`pelican-tab ${screen === "generate" ? "pelican-tab--active" : ""}`}
              onClick={handleGoToGenerate}
            >
              Generate
            </button>
            <button
              type="button"
              className={`pelican-tab ${screen === "scan" ? "pelican-tab--active" : ""}`}
              onClick={handleGoToScan}
            >
              Scan
            </button>
          </div>
        </main>

        {/* Right Column: Top 10 Performing Stores */}
        <div className="desktop-layout__right">
          <TopStoresLeaderboard stores={topStores} />
        </div>
      </div>
    </div>
  );
}
