import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  findMatch: (suffix: string) => string | null;
  placeholder?: string;
};

export default function NumberInput({ value, onChange, onSubmit, findMatch, placeholder }: Props) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value.length >= 4) {
      const match = findMatch(value);
      setSuggestion(match && match !== value ? match : null);
    } else {
      setSuggestion(null);
    }
  }, [value, findMatch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    onChange(raw);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestion) {
        onChange(suggestion);
      }
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
          inputMode="numeric"
          pattern="[0-9]*"
          className="number-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Type last 4-6 digits…"}
          autoComplete="off"
          autoFocus
        />
        {suggestion && (
          <button type="button" className="number-suggestion" onClick={acceptSuggestion}>
            {suggestion}
          </button>
        )}
      </div>
      {value.length > 0 && value.length < 14 && (
        <p className="number-input-hint">
          {value.length}/14 digits {suggestion ? "— Tab or tap suggestion to autocomplete" : ""}
        </p>
      )}
      {value.length === 14 && (
        <p className="number-input-hint number-input-hint--ok">14 digits — ready</p>
      )}
    </div>
  );
}
