import { Globe, Moon, Sun } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export default function Header() {
  const { lang, t, toggle } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();

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

      <div className="hs-header__actions flex items-center gap-2">
        <button
          type="button"
          className="hs-lang-btn p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-all active:scale-95"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title="Toggle Theme"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <button
          type="button"
          className="hs-lang-btn px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs flex items-center gap-1.5 transition-all active:scale-95"
          onClick={toggle}
          aria-label={`Switch to ${lang === "en" ? "Arabic" : "English"}`}
        >
          <Globe size={14} />
          <span>{lang === "en" ? t.ar : t.en}</span>
        </button>
      </div>
    </header>
  );
}
