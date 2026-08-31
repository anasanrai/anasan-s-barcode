import { ArrowLeft, KeyRound, LogOut, Power, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch, clearSession, loadSession, saveSession, type AuthSession } from "@/lib/api";
import { useLang } from "@/lib/i18n";

interface OwnerStore {
  id: string;
  name: string;
  branch: string;
  active: boolean;
  createdAt: string;
}

interface RankedStore {
  id: string;
  name: string;
  branch: string;
  rank: number;
  score: number;
  top10: boolean;
  totalOrders: number;
  pickingMin: number;
  assignmentMin: number;
  fulfillmentRate: number;
  compensationRate: number;
}

interface SubmissionsResponse {
  submissions: Array<{
    storeId: string;
    storeName: string;
    storeBranch: string;
    isoWeek: string;
    totalOrders: number;
    pickingMin: number;
    assignmentMin: number;
    fulfillmentRate: number;
    compensationRate: number;
  }>;
}

export default function OwnerPanel({ onBack }: { onBack: () => void }) {
  const { t } = useLang();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"managers" | "ranking" | "submissions">("managers");

  const [ownerStores, setOwnerStores] = useState<OwnerStore[]>([]);
  const [ranking, setRanking] = useState<RankedStore[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionsResponse["submissions"]>([]);

  const [newName, setNewName] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [newPin, setNewPin] = useState("");

  useEffect(() => {
    const existing = loadSession();
    if (existing?.role === "owner") setSession(existing);
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    void loadOwnerStores();
    void loadRanking();
    void loadSubmissions();
  }, [session]);

  const loadOwnerStores = async () => {
    try {
      const r = await apiFetch<{ stores: OwnerStore[] }>("/owner/stores", { token: session!.token });
      setOwnerStores(r.stores);
    } catch {
      toast.error(t.loadFailed);
    }
  };

  const loadRanking = async () => {
    try {
      const r = await apiFetch<{ stores: RankedStore[] }>("/leaderboard");
      setRanking(r.stores);
    } catch {
      toast.error(t.loadFailed);
    }
  };

  const loadSubmissions = async () => {
    try {
      const r = await apiFetch<SubmissionsResponse>("/owner/submissions", { token: session!.token });
      setSubmissions(r.submissions);
    } catch {
      toast.error(t.loadFailed);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      const r = await apiFetch<{ token: string }>("/auth/login", {
        method: "POST",
        body: { role: "owner", pin },
      });
      const next = { role: "owner" as const, token: r.token };
      saveSession(next);
      setSession(next);
      setPin("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.token) return;
    setBusy(true);
    try {
      await apiFetch("/owner/stores", {
        method: "POST",
        token: session.token,
        body: { name: newName, branch: newBranch, pin: newPin },
      });
      toast.success(t.savedOk);
      setNewName("");
      setNewBranch("");
      setNewPin("");
      await loadOwnerStores();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleResetPin = async (store: OwnerStore) => {
    const input = prompt(t.newPinPrompt);
    if (!input) return;
    if (!/^\d{4,8}$/.test(input)) {
      toast.error(t.invalidPinFormat);
      return;
    }
    try {
      await apiFetch("/owner/stores", {
        method: "PATCH",
        token: session!.token,
        body: { id: store.id, pin: input },
      });
      toast.success(t.savedOk);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.saveFailed);
    }
  };

  const handleToggleActive = async (store: OwnerStore) => {
    try {
      await apiFetch("/owner/stores", {
        method: "PATCH",
        token: session!.token,
        body: { id: store.id, active: !store.active },
      });
      await loadOwnerStores();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.saveFailed);
    }
  };

  const handleCorrect = async (
    storeId: string,
    isoWeek: string,
    metrics: {
      totalOrders: number;
      pickingMin: number;
      assignmentMin: number;
      fulfillmentRate: number;
      compensationRate: number;
    },
  ) => {
    if (!session?.token) return;
    try {
      await apiFetch("/owner/submissions", {
        method: "PUT",
        token: session.token,
        body: { storeId, isoWeek, ...metrics },
      });
      toast.success(t.savedOk);
      await loadSubmissions();
      await loadRanking();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.saveFailed);
    }
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  if (!session) {
    return (
      <main className="admin-page admin-page--login">
        <div className="admin-login-card">
          <h1 className="admin-login-card__title">{t.ownerLoginTitle}</h1>
          <p className="admin-login-card__sub">{t.ownerLoginSub}</p>

          <form onSubmit={handleLogin} className="admin-login-form">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoFocus
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
            <ArrowLeft size={16} /> {t.backToApp}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <button type="button" onClick={onBack} className="admin-back-btn">
          <ArrowLeft size={18} /> {t.backToApp}
        </button>

        <div className="admin-header__tabs">
          <button
            type="button"
            className={`admin-tab ${activeTab === "managers" ? "admin-tab--active" : ""}`}
            onClick={() => setActiveTab("managers")}
          >
            {t.managersTab}
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === "ranking" ? "admin-tab--active" : ""}`}
            onClick={() => setActiveTab("ranking")}
          >
            {t.rankingTab}
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === "submissions" ? "admin-tab--active" : ""}`}
            onClick={() => setActiveTab("submissions")}
          >
            {t.submissionsTab}
          </button>
        </div>

        <button type="button" onClick={handleLogout} className="admin-reset-btn">
          <LogOut size={14} /> {t.logout}
        </button>
      </header>

      {activeTab === "managers" && (
        <section className="admin-panel">
          <h2 className="admin-panel__title">{t.managersTab}</h2>

          <form onSubmit={handleAddStore} className="admin-form admin-add-row">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t.storeNamePlaceholder}
              required
            />
            <input
              type="text"
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              placeholder={t.branchPlaceholder}
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder={t.pinPlaceholder}
              required
            />
            <button type="submit" className="admin-add-store-btn" disabled={busy}>
              {t.addManager}
            </button>
          </form>

          <div className="owner-managers-list">
            {ownerStores.map((store) => (
              <div key={store.id} className={`admin-store-row ${store.active ? "" : "admin-store-row--off"}`}>
                <span className="admin-store-row__name">{store.name}</span>
                <span className="admin-store-row__branch">{store.branch}</span>
                <span className={`admin-store-status ${store.active ? "admin-store-status--on" : ""}`}>
                  {store.active ? t.activeLabel : t.inactiveLabel}
                </span>
                <button
                  type="button"
                  onClick={() => handleResetPin(store)}
                  className="admin-icon-btn"
                  title={t.resetPinTitle}
                >
                  <KeyRound size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(store)}
                  className="admin-icon-btn"
                  title={store.active ? t.deactivateTitle : t.activateTitle}
                >
                  <Power size={14} />
                </button>
              </div>
            ))}
            {ownerStores.length === 0 && <p className="admin-empty">{t.noManagers}</p>}
          </div>
        </section>
      )}

      {activeTab === "ranking" && (
        <section className="admin-panel">
          <h2 className="admin-panel__title">{t.fullRankingTitle}</h2>
          <div className="admin-stores-table">
            <div className="admin-stores-table__head">
              <span>#</span>
              <span>{t.branchLabel}</span>
              <span>{t.scoreLabel}</span>
              <span>{t.totalOrdersLabel}</span>
              <span>{t.pickingTimeLabel}</span>
              <span>{t.assignmentTimeLabel}</span>
            </div>
            {ranking.map((store) => (
              <div key={store.id} className={`admin-stores-table__row ${store.top10 ? "admin-row--top" : ""}`}>
                <span className="admin-stores-rank">{store.rank}</span>
                <span className="admin-row-branch">{store.name} — {store.branch}</span>
                <span className="admin-row-score">{store.score.toFixed(1)}</span>
                <span>{store.totalOrders.toLocaleString()}</span>
                <span>{store.pickingMin} min</span>
                <span>{store.assignmentMin} min</span>
              </div>
            ))}
            {ranking.length === 0 && <p className="admin-empty">{t.noSubmissions}</p>}
          </div>
        </section>
      )}

      {activeTab === "submissions" && (
        <section className="admin-panel">
          <h2 className="admin-panel__title">{t.submissionsTitle}</h2>
          <div className="admin-stores-table">
            {submissions.map((sub) => (
              <div key={`${sub.storeId}-${sub.isoWeek}`} className="admin-stores-table__row">
                <span className="admin-row-week">{sub.isoWeek}</span>
                <span className="admin-row-branch">{sub.storeName} — {sub.storeBranch}</span>
                <input
                  type="number"
                  value={sub.totalOrders}
                  onChange={(e) => setSubmissions((prev) =>
                    prev.map((s) =>
                      s.storeId === sub.storeId && s.isoWeek === sub.isoWeek
                        ? { ...s, totalOrders: parseFloat(e.target.value) || 0 }
                        : s,
                    ),
                  )}
                  title={t.totalOrdersLabel}
                />
                <input
                  type="number"
                  step="0.1"
                  value={sub.pickingMin}
                  onChange={(e) => setSubmissions((prev) =>
                    prev.map((s) =>
                      s.storeId === sub.storeId && s.isoWeek === sub.isoWeek
                        ? { ...s, pickingMin: parseFloat(e.target.value) || 0 }
                        : s,
                    ),
                  )}
                  title={t.pickingTimeLabel}
                />
                <input
                  type="number"
                  step="0.1"
                  value={sub.assignmentMin}
                  onChange={(e) => setSubmissions((prev) =>
                    prev.map((s) =>
                      s.storeId === sub.storeId && s.isoWeek === sub.isoWeek
                        ? { ...s, assignmentMin: parseFloat(e.target.value) || 0 }
                        : s,
                    ),
                  )}
                  title={t.assignmentTimeLabel}
                />
                <input
                  type="number"
                  step="0.1"
                  value={sub.fulfillmentRate}
                  onChange={(e) => setSubmissions((prev) =>
                    prev.map((s) =>
                      s.storeId === sub.storeId && s.isoWeek === sub.isoWeek
                        ? { ...s, fulfillmentRate: parseFloat(e.target.value) || 0 }
                        : s,
                    ),
                  )}
                  title={t.fulfillmentRate}
                />
                <input
                  type="number"
                  step="0.1"
                  value={sub.compensationRate}
                  onChange={(e) => setSubmissions((prev) =>
                    prev.map((s) =>
                      s.storeId === sub.storeId && s.isoWeek === sub.isoWeek
                        ? { ...s, compensationRate: parseFloat(e.target.value) || 0 }
                        : s,
                    ),
                  )}
                  title={t.compensationRateLabel}
                />
                <button
                  type="button"
                  className="admin-icon-btn"
                  title={t.saveCorrectionTitle}
                  onClick={() =>
                    handleCorrect(sub.storeId, sub.isoWeek, {
                      totalOrders: sub.totalOrders,
                      pickingMin: sub.pickingMin,
                      assignmentMin: sub.assignmentMin,
                      fulfillmentRate: sub.fulfillmentRate,
                      compensationRate: sub.compensationRate,
                    })
                  }
                >
                  <Save size={14} />
                </button>
              </div>
            ))}
            {submissions.length === 0 && <p className="admin-empty">{t.noSubmissions}</p>}
          </div>
        </section>
      )}
    </main>
  );
}
