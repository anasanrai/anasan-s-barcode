import { Toaster } from "sonner";
import Home from "./pages/Home";
import ServiceWorkerUpdate from "./components/ServiceWorkerUpdate";
import { LangProvider } from "./lib/i18n";
import { ThemeProvider } from "./lib/theme";
import "./index.css";

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <Home />
        <Toaster position="top-center" richColors />
        <ServiceWorkerUpdate />
      </LangProvider>
    </ThemeProvider>
  );
}
