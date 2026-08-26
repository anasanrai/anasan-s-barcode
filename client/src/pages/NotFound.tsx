import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#101312]">
      <div className="w-full max-w-lg mx-4 p-8 rounded-2xl border border-white/10 bg-[#171b19] text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-[#b8ff3d]/10 rounded-full animate-pulse" />
            <AlertCircle className="relative h-16 w-16 text-[#b8ff3d]" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-[#f1f1e9] mb-2">404</h1>
        <h2 className="text-xl font-semibold text-[#a6aaa0] mb-4">
          Page Not Found
        </h2>
        <p className="text-[#8e9188] mb-8 leading-relaxed">
          Sorry, the page you are looking for doesn&apos;t exist.
          <br />
          It may have been moved or deleted.
        </p>
        <button
          onClick={() => setLocation("/")}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#b8ff3d] text-[#101312] font-semibold hover:brightness-110 transition-all"
        >
          <Home className="w-4 h-4" />
          Go Home
        </button>
      </div>
    </div>
  );
}
