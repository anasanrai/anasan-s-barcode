import { ArrowLeft, Check, Lock, Plus, RefreshCw, Save, Sparkles, Trash2, Trophy, Upload } from "lucide-react";
import { useState } from "react";
import {
  type StarPerformer,
  type StoreLeaderboardItem,
  useLeaderboard,
} from "@/lib/leaderboardStore";

const ADMIN_PIN = "1234";

export default function AdminPage({ onBack }: { onBack: () => void }) {
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState("");
  const [activeTab, setActiveTab] = useState<"performer" | "stores">("performer");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    starPerformer,
    topStores,
    updateStarPerformer,
    updateTopStores,
    resetDefaults,
  } = useLeaderboard();

  // Local state for editing
  const [performerForm, setPerformerForm] = useState<StarPerformer>({ ...starPerformer });
  const [storesForm, setStoresForm] = useState<StoreLeaderboardItem[]>([...topStores]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN || pin === "admin") {
      setIsAuthenticated(true);
      setPinError("");
    } else {
      setPinError("Invalid PIN. Default is 1234");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setPerformerForm((prev) => ({ ...prev, imageUrl: b64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSavePerformer = (e: React.FormEvent) => {
    e.preventDefault();
    updateStarPerformer(performerForm);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleSaveStores = (e: React.FormEvent) => {
    e.preventDefault();
    updateTopStores(storesForm);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleStoreChange = (index: number, field: keyof StoreLeaderboardItem, value: any) => {
    setStoresForm((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddStore = () => {
    setStoresForm((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        rank: prev.length + 1,
        name: "HungerStation Market",
        branch: "New Branch",
        fulfillmentRate: 98.0,
        ordersCount: 1000,
      },
    ]);
  };

  const handleRemoveStore = (index: number) => {
    setStoresForm((prev) => prev.filter((_, i) => i !== index));
  };

  if (!isAuthenticated) {
    return (
      <main className="admin-page admin-page--login">
        <div className="admin-login-card">
          <div className="admin-login-card__icon">
            <Lock size={28} className="lock-icon" />
          </div>
          <h1 className="admin-login-card__title">Admin Control Panel</h1>
          <p className="admin-login-card__sub">Enter PIN to update leaderboard & top performers</p>

          <form onSubmit={handleLogin} className="admin-login-form">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              placeholder="Enter PIN (1234)"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinError("");
              }}
              className="admin-login-input"
            />
            {pinError && <p className="admin-login-error">{pinError}</p>}
            <button type="submit" className="admin-login-btn">
              Unlock
            </button>
          </form>

          <button type="button" onClick={onBack} className="admin-back-btn">
            <ArrowLeft size={16} /> Back to App
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <button type="button" onClick={onBack} className="admin-back-btn">
          <ArrowLeft size={18} /> Back to Scanner & Generator
        </button>

        <div className="admin-header__tabs">
          <button
            type="button"
            className={`admin-tab ${activeTab === "performer" ? "admin-tab--active" : ""}`}
            onClick={() => setActiveTab("performer")}
          >
            <Sparkles size={16} /> Star of the Week
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === "stores" ? "admin-tab--active" : ""}`}
            onClick={() => setActiveTab("stores")}
          >
            <Trophy size={16} /> Top 10 Stores
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (confirm("Reset all leaderboard data to defaults?")) {
              resetDefaults();
              setPerformerForm({ ...starPerformer });
              setStoresForm([...topStores]);
            }
          }}
          className="admin-reset-btn"
          title="Reset Defaults"
        >
          <RefreshCw size={14} /> Reset
        </button>
      </header>

      {saveSuccess && (
        <div className="admin-toast">
          <Check size={16} /> Changes saved successfully!
        </div>
      )}

      {activeTab === "performer" && (
        <section className="admin-panel">
          <h2 className="admin-panel__title">Edit Star of the Week</h2>
          <form onSubmit={handleSavePerformer} className="admin-form">
            <div className="admin-form__group">
              <label>Performer Name</label>
              <input
                type="text"
                value={performerForm.name}
                onChange={(e) => setPerformerForm({ ...performerForm, name: e.target.value })}
                required
              />
            </div>

            <div className="admin-form__group">
              <label>Role / Subtitle</label>
              <input
                type="text"
                value={performerForm.role}
                onChange={(e) => setPerformerForm({ ...performerForm, role: e.target.value })}
                placeholder="Team Leader • Star Performer"
              />
            </div>

            <div className="admin-form__row">
              <div className="admin-form__group">
                <label>Branch / Location</label>
                <input
                  type="text"
                  value={performerForm.branch}
                  onChange={(e) => setPerformerForm({ ...performerForm, branch: e.target.value })}
                  placeholder="Al Maathar Branch"
                />
              </div>

              <div className="admin-form__group">
                <label>Banner Tag</label>
                <input
                  type="text"
                  value={performerForm.badgeTitle}
                  onChange={(e) => setPerformerForm({ ...performerForm, badgeTitle: e.target.value })}
                  placeholder="HungerStation Market"
                />
              </div>
            </div>

            <div className="admin-form__group">
              <label>Header Title</label>
              <input
                type="text"
                value={performerForm.weekLabel}
                onChange={(e) => setPerformerForm({ ...performerForm, weekLabel: e.target.value })}
                placeholder="STAR OF THE WEEK"
              />
            </div>

            <div className="admin-form__group">
              <label>Performer Photo (Upload or URL)</label>
              <div className="admin-photo-input">
                <input
                  type="text"
                  value={performerForm.imageUrl}
                  onChange={(e) => setPerformerForm({ ...performerForm, imageUrl: e.target.value })}
                  placeholder="https://... or upload below"
                />
                <label className="admin-upload-btn">
                  <Upload size={16} /> Choose Image
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="sr-only" />
                </label>
              </div>
              {performerForm.imageUrl && (
                <div className="admin-photo-preview">
                  <img src={performerForm.imageUrl} alt="Preview" />
                </div>
              )}
            </div>

            <div className="admin-form__group">
              <label>Inspirational Quote</label>
              <textarea
                rows={2}
                value={performerForm.quote}
                onChange={(e) => setPerformerForm({ ...performerForm, quote: e.target.value })}
              />
            </div>

            <button type="submit" className="admin-save-btn">
              <Save size={18} /> Save Performer
            </button>
          </form>
        </section>
      )}

      {activeTab === "stores" && (
        <section className="admin-panel">
          <div className="admin-panel__header-row">
            <h2 className="admin-panel__title">Edit Top Performing Stores</h2>
            <button type="button" onClick={handleAddStore} className="admin-add-store-btn">
              <Plus size={16} /> Add Store
            </button>
          </div>

          <form onSubmit={handleSaveStores} className="admin-form">
            <div className="admin-stores-table">
              <div className="admin-stores-table__head">
                <span>Rank</span>
                <span>Branch Name</span>
                <span>Fulfillment %</span>
                <span>Orders Count</span>
                <span>Badge</span>
                <span>Actions</span>
              </div>

              {storesForm.map((store, i) => (
                <div key={store.id || i} className="admin-stores-table__row">
                  <input
                    type="number"
                    className="admin-stores-rank"
                    value={store.rank || i + 1}
                    onChange={(e) => handleStoreChange(i, "rank", parseInt(e.target.value) || i + 1)}
                  />
                  <input
                    type="text"
                    value={store.branch}
                    onChange={(e) => handleStoreChange(i, "branch", e.target.value)}
                    placeholder="Branch name"
                    required
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={store.fulfillmentRate}
                    onChange={(e) => handleStoreChange(i, "fulfillmentRate", parseFloat(e.target.value) || 0)}
                    placeholder="99.4"
                  />
                  <input
                    type="number"
                    value={store.ordersCount}
                    onChange={(e) => handleStoreChange(i, "ordersCount", parseInt(e.target.value) || 0)}
                    placeholder="1400"
                  />
                  <input
                    type="text"
                    value={store.badge || ""}
                    onChange={(e) => handleStoreChange(i, "badge", e.target.value)}
                    placeholder="👑 Top 1"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveStore(i)}
                    className="admin-store-del-btn"
                    aria-label="Remove row"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button type="submit" className="admin-save-btn">
              <Save size={18} /> Save Leaderboard
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
