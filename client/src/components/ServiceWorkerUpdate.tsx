import { useEffect } from "react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";

export default function ServiceWorkerUpdate() {
  const { t } = useLang();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cleanup: (() => void) | undefined;
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const warm = () => {
          navigator.serviceWorker.controller?.postMessage("warm-heavy");
        };
        warm();
        window.addEventListener("online", warm);
        cleanup = () => window.removeEventListener("online", warm);

        registration.onupdatefound = () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.onstatechange = () => {
            if (installing.state === "activated" && navigator.serviceWorker.controller) {
              toast.info(t.updateAvailable ?? "Update available", {
                description: t.updateAvailableDesc ?? "A new version is ready. Reload to use it.",
                duration: 0,
                action: {
                  label: t.reload ?? "Reload",
                  onClick: () => window.location.reload(),
                },
              });
            }
          };
        };
      })
      .catch((err) => {
        console.warn("SW registration error:", err);
      });

    return () => cleanup?.();
  }, [t]);

  return null;
}
