import { Globe, Download, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getInstallMode, isIosUserAgent, isStandaloneDisplay, type InstallMode } from "@/lib/install";
import { useLang } from "@/lib/i18n";

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function Header() {
  const { lang, t, toggle } = useLang();
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

  const startInstall = async () => {
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
    <header className="hs-header">
      <a href="/" className="hs-logo" aria-label="HungerStation">
        <svg className="hs-logo__img" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <rect width="512" height="512" rx="100" fill="#FBEF00"/>
          <g transform="translate(80, 60)">
            <path d="M166.4 0C130.2 0 99.2 14.6 75.2 42L0 220h88l37.2-112c8.8-26.4 26.4-40.4 52.4-40.4h22c26 0 43.6 14 52.4 40.4L244 220h88L255.2 42C231.2 14.6 200.2 0 164 0h2.4z" fill="#1A0F0A"/>
            <path d="M0 260h88l37.2-68L164 260h88l-76.8-140L328 260h88L300 120l116 140h72" fill="none" stroke="#1A0F0A" strokeWidth="24" strokeLinecap="round"/>
          </g>
        </svg>
        <span className="hs-logo__text">HungerTag</span>
      </a>

      <div className="hs-header__actions">
        <button type="button" className="hs-lang-btn" onClick={toggle} aria-label={`Switch to ${lang === "en" ? "Arabic" : "English"}`}>
          <Globe size={14} />
          <span>{lang === "en" ? t.ar : t.en}</span>
        </button>

        {mode !== "installed" && (
          <button type="button" className="hs-install-btn" onClick={() => void startInstall()}>
            <Download size={14} />
            <span>{t.install}</span>
          </button>
        )}
      </div>

      {showGuide && (
        <div className="hs-overlay" onClick={() => setShowGuide(false)}>
          <section className="install-sheet" role="dialog" aria-label={t.installTitle} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="install-sheet__close" onClick={() => setShowGuide(false)} aria-label="Close"><X size={16} /></button>
            {mode === "ios-guide" ? (
              <>
                <span className="install-sheet__icon"><Share2 size={18} /></span>
                <strong>{t.addHomeScreen}</strong>
                <p dangerouslySetInnerHTML={{ __html: t.iosGuide }} />
              </>
            ) : (
              <>
                <span className="install-sheet__icon"><Download size={18} /></span>
                <strong>{t.installFromBrowser}</strong>
                <p dangerouslySetInnerHTML={{ __html: t.browserGuide }} />
              </>
            )}
          </section>
        </div>
      )}
    </header>
  );
}
