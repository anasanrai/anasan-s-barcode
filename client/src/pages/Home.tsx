import { useCallback, useEffect, useRef, useState } from "react";
import BarcodeGenerator from "@/components/BarcodeGenerator";
import PelicanScanner from "@/components/PelicanScanner";
import Header from "@/components/Header";
import LeaderboardModal from "@/components/LeaderboardModal";
import LookupPanel from "@/components/LookupPanel";
import AdminPage from "./AdminPage";
import StarGalleryPage from "./StarGalleryPage";
import AboutPage from "./AboutPage";
import { useNumberHistory } from "@/lib/useNumberHistory";
import type { Product } from "@/lib/productDb";

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

type Screen = "scan" | "generate" | "lookup";

export default function Home() {
  const isMobile = useIsMobile();
  const [screen, setScreen] = useState<Screen>(() => {
    const qp = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("screen") : null;
    if (qp === "scan" || qp === "generate" || qp === "lookup") return qp;
    return isMobile ? "scan" : "generate";
  });
  const [view, setView] = useState<"app" | "admin" | "stars" | "about">(initialView);
  const [detectedNumber, setDetectedNumber] = useState("");
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  // Track the barcode pushed from Lookup → Generator
  // Use a versioned object so the same barcode can be pushed repeatedly
  const [pushedBarcode, setPushedBarcode] = useState<{ value: string; version: number } | null>(null);
  const pushVersion = useRef(0);

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

  /** Called by LookupPanel when a product is selected */
  const handleProductSelect = useCallback((_barcode: string, product: Product) => {
    pushVersion.current += 1;
    setPushedBarcode({ value: product.barcode, version: pushVersion.current });
    setScreen("generate");
  }, []);

  const handleGoToScan = () => setScreen("scan");
  const handleGoToGenerate = () => setScreen("generate");
  const handleGoToLookup = () => setScreen("lookup");

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

  /** Tab bar shared across mobile screens */
  const tabBar = (
    <div className="pelican-tabs">
      <button
        type="button"
        className={`pelican-tab ${screen === "scan" ? "pelican-tab--active" : ""}`}
        onClick={handleGoToScan}
      >
        Scan
      </button>
      <button
        type="button"
        className={`pelican-tab ${screen === "generate" ? "pelican-tab--active" : ""}`}
        onClick={handleGoToGenerate}
      >
        Generate
      </button>
      <button
        type="button"
        className={`pelican-tab pelican-tab--lookup ${screen === "lookup" ? "pelican-tab--active" : ""}`}
        onClick={handleGoToLookup}
      >
        Lookup
      </button>
    </div>
  );

  // Mobile layout (< 1100px)
  if (isMobile) {
    return (
      <>
        {screen === "scan" && (
          <main className="pelican-app">
            <Header
              onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
              onGoToAdmin={handleOpenAdmin}
              onOpenAbout={handleOpenAbout}
            />
            <PelicanScanner onDetected={handleDetected} />
            {tabBar}
          </main>
        )}

        {screen === "generate" && (
          <main className="pelican-app pelican-app--generator">
            <Header
              onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
              onGoToAdmin={handleOpenAdmin}
              onOpenAbout={handleOpenAbout}
            />
            <BarcodeGenerator
              initialValue={detectedNumber}
              pushedValue={pushedBarcode ? `${pushedBarcode.value}__v${pushedBarcode.version}` : undefined}
            />
            {tabBar}
          </main>
        )}

        {screen === "lookup" && (
          <main className="pelican-app pelican-app--lookup">
            <Header
              onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
              onGoToAdmin={handleOpenAdmin}
              onOpenAbout={handleOpenAbout}
            />
            <LookupPanel onSelect={handleProductSelect} />
            {tabBar}
          </main>
        )}

        <LeaderboardModal
          isOpen={isLeaderboardOpen}
          onClose={() => setIsLeaderboardOpen(false)}
          onOpenStars={handleOpenStars}
        />
      </>
    );
  }

  // Desktop layout (>= 1100px): centered, generator-first stage
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
        ) : screen === "lookup" ? (
          <div className="desktop-stage__lookup">
            <LookupPanel onSelect={handleProductSelect} />
          </div>
        ) : (
          <div className="desktop-stage__generator">
            <BarcodeGenerator
              initialValue={detectedNumber}
              pushedValue={pushedBarcode ? `${pushedBarcode.value}__v${pushedBarcode.version}` : undefined}
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
          Generate
        </button>
        <button
          type="button"
          className={`pelican-tab ${screen === "scan" ? "pelican-tab--active" : ""}`}
          onClick={handleGoToScan}
        >
          Scan
        </button>
        <button
          type="button"
          className={`pelican-tab pelican-tab--lookup ${screen === "lookup" ? "pelican-tab--active" : ""}`}
          onClick={handleGoToLookup}
        >
          Lookup
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
