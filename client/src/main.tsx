import { createRoot } from "react-dom/client";
import App from "./App";

if ("serviceWorker" in navigator) {
  const registerSW = () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("SW registration error:", err);
    });
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    registerSW();
  } else {
    window.addEventListener("load", registerSW);
  }
}

createRoot(document.getElementById("root")!).render(<App />);
