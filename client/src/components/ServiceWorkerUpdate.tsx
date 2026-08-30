import { useEffect } from "react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";

export default function ServiceWorkerUpdate() {
  const { t } = useLang();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
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
    }
  }, [t]);

  return null;
}
