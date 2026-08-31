import { useEffect, useState } from "react";
import ManagerPortal from "./ManagerPortal";
import OwnerPanel from "./OwnerPanel";
import { apiFetch, clearSession, loadSession, saveSession, type AuthSession } from "@/lib/api";
import { useLang } from "@/lib/i18n";

const OWNER_OPTION = "__owner__";

interface PublicStore {
  id: string;
  name: string;
  branch: string;
}

export default function AdminPage({ onBack }: { onBack: () => void }) {
  const { t } = useLang();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checked, setChecked] = useState(false);
  const [stores, setStores] = useState<PublicStore[]>([]);
  const [storeId, setStoreId] = useState("");
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const existing = loadSession();
    if (existing) setSession(existing);
    setChecked(true);
    apiFetch<{ stores: PublicStore[] }>("/stores")
      .then((r) => setStores(r.stores))
      .catch(() => setStores([]));
  }, []);

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  if (!checked) {
    return <main className="admin-page admin-page--login" />;
  }

  if (session?.role === "manager") {
    return <ManagerPortal session={session} onLogout={handleLogout} onBack={onBack} />;
  }
  if (session?.role === "owner") {
    return <OwnerPanel session={session} onLogout={handleLogout} onBack={onBack} />;
  }


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      if (storeId === OWNER_OPTION) {
        const r = await apiFetch<{ token: string }>("/auth/login", {
          method: "POST",
          body: { role: "owner", pin },
        });
        const next = { role: "owner" as const, token: r.token };
        saveSession(next);
        setSession(next);
      } else {
        const r = await apiFetch<{ token: string; store: PublicStore }>("/auth/login", {
          method: "POST",
          body: { role: "manager", storeId, pin },
        });
        const next = {
          role: "manager" as const,
          token: r.token,
          storeId: r.store.id,
          storeName: r.store.name,
          storeBranch: r.store.branch,
        };
        saveSession(next);
        setSession(next);
      }
      setPin("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-page admin-page--login">
      <div className="admin-login-card">
        <h1 className="admin-login-card__title">{t.adminPortalTitle}</h1>
        <p className="admin-login-card__sub">{t.adminPortalSub}</p>

        <form onSubmit={handleLogin} className="admin-login-form">
          <select
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              setLoginError("");
            }}
            className="admin-login-input"
            required
            aria-label={t.storeLabel}
          >
            <option value="">{t.selectStore}</option>
            <option value={OWNER_OPTION}>{t.ownerOption}</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.branch}
              </option>
            ))}
          </select>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder={t.pinPlaceholder}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setLoginError("");
            }}
            className="admin-login-input"
            required
          />
          {loginError && <p className="admin-login-error">{loginError}</p>}
          <button type="submit" className="admin-login-btn" disabled={busy}>
            {t.unlock}
          </button>
        </form>

        <button type="button" onClick={onBack} className="admin-back-btn">
          {t.backToApp}
        </button>
      </div>
    </main>
  );
}
