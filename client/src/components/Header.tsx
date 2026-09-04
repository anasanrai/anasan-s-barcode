import { Download, Globe, Settings, Share2, Trophy, User, X } from "lucide-react";
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
  onOpenAbout?: () => void;
}

export default function Header({ onOpenLeaderboard, onGoToAdmin, onOpenAbout }: Props) {
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

        {!standalone && (
          <a
            className="hs-install-btn"
            href="https://github.com/anasanrai/anasan-s-barcode/releases/latest"
            target="_blank"
            rel="noreferrer"
            aria-label={t.install}
            title="Install / Download APK from GitHub Release"
          >
            <Download size={14} />
            <span>{t.install}</span>
          </a>
        )}

        {onOpenAbout && (
          <button
            type="button"
            className="hs-about-btn"
            onClick={onOpenAbout}
            aria-label="About"
            title="About"
          >
            <User size={14} />
          </button>
        )}

        <a
          className="hs-github-btn"
          href="https://github.com/anasanrai/anasan-s-barcode"
          target="_blank"
          rel="noreferrer"
          aria-label="View on GitHub"
          title="View on GitHub"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-1.17-.07-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.78-1.03 2.2-.82 2.2-.82.36.86.28 1.78.09 2.2.51.5.82 1.17.82 1.17 0 1.02-.62 1.48-1.18 1.66.18.41.27.86.27 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          <span className="hs-github-btn__label">GitHub</span>
        </a>

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
