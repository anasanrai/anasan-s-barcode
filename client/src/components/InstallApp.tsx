import { Download, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getInstallMode, isIosUserAgent, type InstallMode } from "@/lib/install";

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay(): boolean {
  const safariStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || safariStandalone === true;
}

export default function InstallApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setIsStandalone(isStandaloneDisplay());
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPrompt);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowGuide(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const mode: InstallMode = getInstallMode({
    isIos: isIosUserAgent(navigator.userAgent),
    isStandalone,
    hasDeferredPrompt: deferredPrompt !== null,
  });

  if (mode === "installed") return null;

  const installLabel = mode === "ios-guide" ? "Install on iPhone" : mode === "native-prompt" ? "Install app" : "Install app";

  const startInstall = async () => {
    if (mode === "ios-guide") {
      setNotice("");
      setShowGuide(true);
      return;
    }
    if (!deferredPrompt) {
      setNotice("Use your browser menu and choose “Install app” or “Add to Home screen”.");
      setShowGuide(true);
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "dismissed") setNotice("Installation was not completed. You can install again whenever you are ready.");
  };

  return (
    <div className="install-control">
      <button type="button" className="install-trigger" onClick={() => void startInstall()} aria-haspopup={showGuide ? "dialog" : undefined}>
        <Download size={15} /> {installLabel}
      </button>
      {(showGuide || notice) && (
        <section className="install-sheet" role="dialog" aria-modal="false" aria-label="Install Number to Barcode">
          <button type="button" className="install-sheet__close" onClick={() => { setShowGuide(false); setNotice(""); }} aria-label="Close install instructions"><X size={16} /></button>
          {mode === "ios-guide" ? (
            <>
              <span className="install-sheet__icon"><Share2 size={18} /></span>
              <strong>Add Number to Barcode to your Home Screen</strong>
              <p>In Safari, tap <b>Share</b>, choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</p>
            </>
          ) : (
            <>
              <span className="install-sheet__icon"><Download size={18} /></span>
              <strong>Install from your browser menu</strong>
              <p>{notice || "Choose “Install app” or “Add to Home screen” in your browser menu to keep Number to Barcode on your phone."}</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
