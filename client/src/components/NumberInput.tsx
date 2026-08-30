import { useEffect, useRef, useState } from "react";
import type { BarcodeFormat } from "./BarcodePreview";
import { useLang } from "@/lib/i18n";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  findMatch: (suffix: string) => string | null;
  placeholder?: string;
  format?: BarcodeFormat;
};

const NUMERIC_ONLY = new Set(["EAN13", "EAN8", "UPC", "ITF14"]);

export default function NumberInput({ value, onChange, onSubmit, findMatch, placeholder, format = "CODE128" }: Props) {
  const { t } = useLang();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isNumericOnly = NUMERIC_ONLY.has(format);

  useEffect(() => {
    if (value.length >= 4) {
      const match = findMatch(value);
      setSuggestion(match && match !== value ? match : null);
    } else {
      setSuggestion(null);
    }
  }, [value, findMatch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = isNumericOnly
      ? e.target.value.replace(/[^0-9]/g, "")
      : e.target.value.replace(/[^A-Za-z0-9\-.\ \$\/\+\%]/g, "").toUpperCase();
    onChange(raw);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestion) { onChange(suggestion); }
      onSubmit();
    }
    if (e.key === "Tab" && suggestion) {
      e.preventDefault();
      onChange(suggestion);
    }
  };

  const acceptSuggestion = () => {
    if (suggestion) {
      onChange(suggestion);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="number-input-wrap">
      <div className="number-input-row">
        <input
          ref={inputRef}
          type="text"
          inputMode={isNumericOnly ? "numeric" : "text"}
          pattern={isNumericOnly ? "[0-9]*" : undefined}
          className="number-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? (isNumericOnly ? t.enterDigits : t.enterText)}
          autoComplete="off"
          autoFocus
        />
        {suggestion && (
          <button type="button" className="number-suggestion" onClick={acceptSuggestion}>
            {suggestion}
          </button>
        )}
      </div>
      {value.length > 0 && (
        <p className="number-input-hint">
          {isNumericOnly ? t.digits(value.length) : t.chars(value.length)}
          {suggestion ? t.tabOrTap : ""}
        </p>
      )}
    </div>
  );
}
