/** Signal Field mobile tool: keep installation one tap away without distracting from the live camera. */

import { Download, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./install-app.css";

type InstallChoiceEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export default function InstallAppControl() {
  const deferredPrompt = useRef<InstallChoiceEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(
    () => typeof window !== "undefined" && isStandalone()
  );

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as InstallChoiceEvent;
    };
    const onInstalled = () => {
      deferredPrompt.current = null;
      setInstalled(true);
      setOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    const event = deferredPrompt.current;
    if (!event) {
      setOpen(true);
      return;
    }
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setOpen(false);
    } else setOpen(true);
    deferredPrompt.current = null;
  };

  return (
    <div className="install-app-control">
      <button
        className="install-app-trigger"
        onClick={() => void install()}
        aria-label={
          installed ? "App installation status" : "Install Number to Barcode"
        }
        title={installed ? "App installed" : "Install app"}
      >
        {installed ? <Smartphone size={16} /> : <Download size={16} />}
        <span>{installed ? "Installed" : "Install"}</span>
      </button>
      {open && (
        <div
          className="install-app-sheet"
          role="dialog"
          aria-label="Install Number to Barcode"
        >
          <button
            className="install-sheet-close"
            onClick={() => setOpen(false)}
            aria-label="Close install instructions"
          >
            <X size={15} />
          </button>
          <div className="install-sheet-icon">
            <Smartphone size={18} />
          </div>
          <strong>
            {installed ? "App is installed" : "Install this scanner"}
          </strong>
          <p>
            {installed
              ? "Open Number to Barcode from your home screen for the fastest camera start."
              : "Use your browser menu and choose Install app. On iPhone, use Share, then Add to Home Screen."}
          </p>
        </div>
      )}
    </div>
  );
}
