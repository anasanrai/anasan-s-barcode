import { Download, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getInstallMode, isIosUserAgent, isStandaloneDisplay, type InstallMode } from "@/lib/install";

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallApp() {
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as DeferredPrompt);
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
      setShowGuide(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const mode: InstallMode = getInstallMode({
    isIos: isIosUserAgent(navigator.userAgent),
    isStandalone: standalone,
    hasDeferredPrompt: deferred !== null,
  });

  if (mode === "installed") return null;

  const label = mode === "ios-guide" ? "Install" : "Install";
  const start = async () => {
    if (mode === "ios-guide") {
      setShowGuide(true);
      return;
    }
    if (!deferred) {
      setShowGuide(true);
      return;
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "dismissed") setShowGuide(true);
  };

  return (
    <div className="install-control">
      <button type="button" className="install-trigger" onClick={() => void start()} aria-haspopup={showGuide ? "dialog" : undefined}>
        <Download size={15} /> {label}
      </button>
      {showGuide && (
        <section className="install-sheet" role="dialog" aria-label="Install Pelican Barcode">
          <button type="button" className="install-sheet__close" onClick={() => setShowGuide(false)} aria-label="Close"><X size={16} /></button>
          {mode === "ios-guide" ? (
            <>
              <span className="install-sheet__icon"><Share2 size={18} /></span>
              <strong>Add to Home Screen</strong>
              <p>In Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>, then <b>Add</b>.</p>
            </>
          ) : (
            <>
              <span className="install-sheet__icon"><Download size={18} /></span>
              <strong>Install from your browser menu</strong>
              <p>Open your browser menu and choose <b>Install app</b> or <b>Add to Home Screen</b>.</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
