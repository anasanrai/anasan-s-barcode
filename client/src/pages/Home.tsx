import { useCallback, useEffect, useState } from "react";
import { Barcode, Camera, Sparkles } from "lucide-react";
import BarcodeGenerator from "@/components/BarcodeGenerator";
import PelicanScanner from "@/components/PelicanScanner";
import Header from "@/components/Header";
import LeaderboardModal from "@/components/LeaderboardModal";
import AdminPage from "./AdminPage";
import StarGalleryPage from "./StarGalleryPage";
import AboutPage from "./AboutPage";
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

function initialView(): "app" | "admin" | "stars" | "about" {
  if (typeof window === "undefined") return "app";
  if (window.location.pathname.startsWith("/admin")) return "admin";
  if (window.location.pathname.startsWith("/stars")) return "stars";
  if (window.location.pathname.startsWith("/about")) return "about";
  return "app";
}

type Screen = "scan" | "generate";

export default function Home() {
  const { t } = useLang();
  const isMobile = useIsMobile();
  const [screen, setScreen] = useState<Screen>(() => {
    const qp = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("screen") : null;
    if (qp === "scan") return "scan";
    if (qp === "generate" || qp === "lookup") return "generate";
    return isMobile ? "scan" : "generate";
  });
  const [view, setView] = useState<"app" | "admin" | "stars" | "about">(initialView);
  const [detectedNumber, setDetectedNumber] = useState("");
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  const { addNumber } = useNumberHistory();

  useEffect(() => {
    setScreen(isMobile ? "scan" : "generate");
  }, [isMobile]);

  // Listen for browser popstate / back button
  useEffect(() => {
    const onPop = () => {
      if (window.location.pathname.startsWith("/admin")) {
        setView("admin");
      } else if (window.location.pathname.startsWith("/stars")) {
        setView("stars");
      } else if (window.location.pathname.startsWith("/about")) {
        setView("about");
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

  const handleOpenStars = () => {
    window.history.pushState({}, "", "/stars");
    setView("stars");
  };

  const handleCloseStars = () => {
    window.history.pushState({}, "", "/");
    setView("app");
  };

  const handleOpenAbout = () => {
    window.history.pushState({}, "", "/about");
    setView("about");
  };

  const handleCloseAbout = () => {
    window.history.pushState({}, "", "/");
    setView("app");
  };

  if (view === "admin") {
    return <AdminPage onBack={handleCloseAdmin} />;
  }

  if (view === "stars") {
    return <StarGalleryPage onBack={handleCloseStars} />;
  }

  if (view === "about") {
    return <AboutPage onBack={handleCloseAbout} />;
  }

  /** Unified 2-surface tab bar */
  const tabBar = (
    <div className="pelican-tabs">
      <button
        type="button"
        className={`pelican-tab ${screen === "scan" ? "pelican-tab--active" : ""}`}
        onClick={handleGoToScan}
      >
        <Camera size={16} />
        <span>{t.scan}</span>
      </button>
      <button
        type="button"
        className={`pelican-tab ${screen === "generate" ? "pelican-tab--active" : ""}`}
        onClick={handleGoToGenerate}
      >
        <Barcode size={16} />
        <span>{t.generate}</span>
      </button>
    </div>
  );

  // Mobile layout (< 1100px)
  if (isMobile) {
    return (
      <div className="pelican-mobile-shell">
        <Header
          onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
          onGoToAdmin={handleOpenAdmin}
          onOpenAbout={handleOpenAbout}
        />
        <main className={`pelican-app pelican-app--${screen}`}>
          {screen === "scan" && <PelicanScanner onDetected={handleDetected} />}
          {screen === "generate" && (
            <BarcodeGenerator
              initialValue={detectedNumber}
            />
          )}
        </main>
        {tabBar}

        <LeaderboardModal
          isOpen={isLeaderboardOpen}
          onClose={() => setIsLeaderboardOpen(false)}
          onOpenStars={handleOpenStars}
        />
      </div>
    );
  }

  // Desktop layout (>= 1100px): centered, generator & lookup store workbench
  return (
    <div className="desktop-workspace">
      <Header
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onGoToAdmin={handleOpenAdmin}
        onOpenAbout={handleOpenAbout}
      />

      <main className="desktop-stage">
        {screen === "scan" ? (
          <div className="desktop-stage__scanner">
            <PelicanScanner onDetected={handleDetected} />
          </div>
        ) : (
          <div className="desktop-stage__generator">
            <BarcodeGenerator
              initialValue={detectedNumber}
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
          <span>{t.generate}</span>
        </button>
        <button
          type="button"
          className={`pelican-tab ${screen === "scan" ? "pelican-tab--active" : ""}`}
          onClick={handleGoToScan}
        >
          <Camera size={16} />
          <span>{t.scan}</span>
        </button>
      </div>

      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        onOpenStars={handleOpenStars}
      />
    </div>
  );
}
