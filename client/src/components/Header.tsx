import { Download, Globe, Moon, Sun, User } from "lucide-react";
import { useEffect, useState } from "react";
import { isStandaloneDisplay } from "@/lib/install";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

interface Props {
  onOpenAbout?: () => void;
}

export default function Header({ onOpenAbout }: Props) {
  const { lang, t, toggle } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
  }, []);

  return (
    <header className="hs-header">
      <div className="hs-logo flex items-center gap-2">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FF7A18"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M3 5v14" />
          <path d="M8 5v14" />
          <path d="M12 5v14" />
          <path d="M17 5v14" />
          <path d="M21 5v14" />
        </svg>
        <span className="font-bold text-sm tracking-tight text-white">
          ANASAN<span className="text-[#FF7A18]">BARCODE</span>
        </span>
      </div>

      <div className="hs-header__actions">
        <button
          type="button"
          className="hs-lang-btn"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title="Toggle Theme"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <button
          type="button"
          className="hs-lang-btn"
          onClick={toggle}
          aria-label={`Switch to ${lang === "en" ? "Arabic" : "English"}`}
        >
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
      </div>
    </header>
  );
}
