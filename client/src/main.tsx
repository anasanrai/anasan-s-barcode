import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator && (window.isSecureContext || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    let reloadingForNewWorker = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForNewWorker) return;
      reloadingForNewWorker = true;
      window.location.reload();
    });
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => registration.update());
  }, { once: true });
}

createRoot(document.getElementById("root")!).render(<App />);
