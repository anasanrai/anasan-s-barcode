import { Download, Globe, Settings, Share2, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getInstallMode, isIosUserAgent, isStandaloneDisplay, type InstallMode } from "@/lib/install";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

interface Props {
  onOpenLeaderboard?: () => void;
  onGoToAdmin?: () => void;
}

export default function Header({ onOpenLeaderboard, onGoToAdmin }: Props) {
  const { lang, t, toggle } = useLang();
  const { toggle: toggleTheme } = useTheme();
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(() => {
    return typeof window !== "undefined" ? (window as unknown as { __deferredPrompt?: DeferredPrompt }).__deferredPrompt ?? null : null;
  });
  const [standalone, setStandalone] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __deferredPrompt?: DeferredPrompt }).__deferredPrompt = e as DeferredPrompt;
      setDeferred(e as DeferredPrompt);
    };
    const onPromptReady = () => {
      const p = (window as unknown as { __deferredPrompt?: DeferredPrompt }).__deferredPrompt;
      if (p) setDeferred(p);
    };
    const onInstalled = () => {
      (window as unknown as { __deferredPrompt?: DeferredPrompt | null }).__deferredPrompt = null;
      setDeferred(null);
      setStandalone(true);
      setShowGuide(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("app-prompt-ready", onPromptReady);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("app-prompt-ready", onPromptReady);
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
    const promptEvent = deferred || (window as unknown as { __deferredPrompt?: DeferredPrompt }).__deferredPrompt;
    if (!promptEvent) {
      setShowGuide(true);
      return;
    }
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      (window as unknown as { __deferredPrompt?: DeferredPrompt | null }).__deferredPrompt = null;
      setDeferred(null);
      if (outcome === "dismissed") setShowGuide(true);
    } catch {
      setShowGuide(true);
    }
  };

  return (
    <header className="hs-header">
      <button type="button" className="hs-logo" aria-label="Toggle theme" onClick={toggleTheme}>
        <img src="/hungerstation-logo-shadow.1vx_waus0h43y.svg" alt="HungerStation" className="hs-logo__img" />
      </button>

      <div className="hs-header__actions">
        {onOpenLeaderboard && (
          <button
            type="button"
            className="hs-leaderboard-btn"
            onClick={onOpenLeaderboard}
            aria-label={t.leaderboard}
            title={t.leaderboard}
          >
            <Trophy size={14} className="trophy-gold" />
            <span>{t.leaderboard}</span>
          </button>
        )}

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

        {onGoToAdmin && (
          <button
            type="button"
            className="hs-admin-btn"
            onClick={onGoToAdmin}
            aria-label={t.admin}
            title={t.admin}
          >
            <Settings size={14} />
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
