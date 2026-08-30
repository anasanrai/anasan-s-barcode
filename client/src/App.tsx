import { Toaster } from "sonner";
import Home from "./pages/Home";
import { LangProvider } from "./lib/i18n";
import "./index.css";

export default function App() {
  return (
    <LangProvider>
      <Home />
      <Toaster position="top-center" richColors />
    </LangProvider>
  );
}
