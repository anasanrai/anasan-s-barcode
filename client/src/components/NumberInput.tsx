import { Mic, MicOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BarcodeFormat } from "./BarcodePreview";
import { useLang } from "@/lib/i18n";
import { normalizeSpokenInput } from "@/lib/voice";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  findMatch: (suffix: string) => string | null;
  placeholder?: string;
  format?: BarcodeFormat;
};

const NUMERIC_ONLY = new Set(["EAN13", "EAN8", "UPC", "ITF14"]);

// Web Speech API interface definitions
interface SpeechRecognitionResultItem {
  transcript: string;
}
interface SpeechRecognitionResultList {
  [index: number]: {
    [index: number]: SpeechRecognitionResultItem;
  };
  length: number;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

export default function NumberInput({
  value,
  onChange,
  onSubmit,
  findMatch,
  placeholder,
  format = "CODE128",
}: Props) {
  const { lang, t } = useLang();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
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

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  const stopVoice = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startVoice = useCallback(() => {
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      alert(t.voiceUnsupported);
      return;
    }

    stopVoice();

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang === "ar" ? "ar-SA" : "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript + " ";
        }
        const parsed = normalizeSpokenInput(fullTranscript, isNumericOnly);
        if (parsed) {
          onChange(parsed);
        }
      };

      recognition.onerror = () => {
        stopVoice();
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, [lang, isNumericOnly, onChange, stopVoice, t.voiceUnsupported]);

  const toggleVoice = () => {
    if (isListening) {
      stopVoice();
    } else {
      startVoice();
    }
  };

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      stopVoice();
    };
  }, [stopVoice]);

  return (
    <div className="number-input-wrap">
      <div className={`number-input-row ${isListening ? "number-input-row--listening" : ""}`}>
        <input
          ref={inputRef}
          type="text"
          inputMode={isNumericOnly ? "numeric" : "text"}
          pattern={isNumericOnly ? "[0-9]*" : undefined}
          className="number-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? t.listening : placeholder ?? (isNumericOnly ? t.enterDigits : t.enterText)}
          autoComplete="off"
          autoFocus
        />

        <div className="number-input__actions">
          {value.length > 0 && (
            <button
              type="button"
              className="number-input__btn number-input__btn--clear"
              onClick={handleClear}
              aria-label={t.clear}
              title={t.clear}
            >
              <X size={16} />
            </button>
          )}

          <button
            type="button"
            className={`number-input__btn number-input__btn--voice ${isListening ? "number-input__btn--listening" : ""}`}
            onClick={toggleVoice}
            aria-label={t.voiceTyping}
            title={t.voiceTyping}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        </div>

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
