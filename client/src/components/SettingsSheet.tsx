/** Signal Field design system: settings are a focused control sheet, exposing precision settings without disrupting scan flow. */

import { History, Settings2, X } from "lucide-react";
import type { BarcodeFormat } from "@/services/number";
import type { HistoryItem } from "@/services/history";

export type AppSettings = {
  format: BarcodeFormat;
  minLength: number;
  maxLength: number;
  autoCapture: boolean;
  highContrast: boolean;
  invert: boolean;
  keepHistory: boolean;
};

type SettingsSheetProps = {
  mode: "settings" | "history";
  settings: AppSettings;
  history: HistoryItem[];
  onSettingsChange: (next: AppSettings) => void;
  onClose: () => void;
  onClearHistory: () => void;
  onRemoveHistory: (id: string) => void;
  onReuse: (item: HistoryItem) => void;
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button className={`toggle ${checked ? "on" : ""}`} onClick={onChange} aria-pressed={checked} aria-label={label}><span /></button>;
}

export default function SettingsSheet({ mode, settings, history, onSettingsChange, onClose, onClearHistory, onRemoveHistory, onReuse }: SettingsSheetProps) {
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => onSettingsChange({ ...settings, [key]: value });

  return (
    <div className="sheet-scrim" role="presentation" onMouseDown={onClose}>
      <aside className="utility-sheet" role="dialog" aria-modal="true" aria-label={mode === "settings" ? "Settings" : "Local history"} onMouseDown={(event) => event.stopPropagation()}>
        <header className="sheet-header"><div><span className="eyebrow">{mode === "settings" ? "Configuration" : "On this device"}</span><h2>{mode === "settings" ? "Settings" : "Recent conversions"}</h2></div><button className="icon-control ink" onClick={onClose} aria-label="Close panel"><X size={19} /></button></header>
        {mode === "settings" ? (
          <div className="sheet-content">
            <label className="setting-field"><span>Default barcode format</span><select value={settings.format} onChange={(event) => update("format", event.target.value as BarcodeFormat)}><option value="CODE128">Code 128 — recommended</option><option value="CODE39">Code 39</option><option value="EAN13">EAN-13</option></select></label>
            <div className="setting-pair"><label className="setting-field"><span>Minimum digits</span><input type="number" min="1" max="30" value={settings.minLength} onChange={(event) => update("minLength", Number(event.target.value))} /></label><label className="setting-field"><span>Maximum digits</span><input type="number" min="4" max="60" value={settings.maxLength} onChange={(event) => update("maxLength", Number(event.target.value))} /></label></div>
            <div className="setting-row"><div><strong>Automatic capture</strong><p>Generate after 3 stable readings.</p></div><Toggle checked={settings.autoCapture} onChange={() => update("autoCapture", !settings.autoCapture)} label="Toggle automatic capture" /></div>
            <div className="setting-row"><div><strong>High Contrast</strong><p>Deepen light/dark separation in preview.</p></div><Toggle checked={settings.highContrast} onChange={() => update("highContrast", !settings.highContrast)} label="Toggle high contrast" /></div>
            <div className="setting-row"><div><strong>Invert Colors</strong><p>For bright-on-dark display numbers.</p></div><Toggle checked={settings.invert} onChange={() => update("invert", !settings.invert)} label="Toggle invert colors" /></div>
            <div className="setting-row"><div><strong>Keep history</strong><p>Stored only in this browser.</p></div><Toggle checked={settings.keepHistory} onChange={() => update("keepHistory", !settings.keepHistory)} label="Toggle local history" /></div>
            <div className="private-note"><Settings2 size={17} /><p>Camera images are not saved or uploaded. Recognition happens in your browser.</p></div>
          </div>
        ) : (
          <div className="sheet-content history-content">
            <div className="history-intro"><History size={18} /><p>Successful conversions are stored locally only. Delete them at any time.</p></div>
            {history.length ? <><div className="history-list">{history.map((item) => <article key={item.id} className="history-item"><button className="history-main" onClick={() => onReuse(item)}><strong>{item.value}</strong><span>{item.format.replace("CODE", "Code ")} · {new Date(item.createdAt).toLocaleDateString()}</span></button><button className="history-remove" onClick={() => onRemoveHistory(item.id)} aria-label={`Remove ${item.value}`}>×</button></article>)}</div><button className="clear-history" onClick={onClearHistory}>Clear local history</button></> : <div className="empty-history"><span>∅</span><strong>No saved conversions</strong><p>Your successful barcodes will appear here on this device.</p></div>}
          </div>
        )}
      </aside>
    </div>
  );
}
