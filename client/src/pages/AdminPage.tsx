import { ArrowLeft, Check, ImagePlus, Lock, Plus, RefreshCw, Save, Sparkles, Trash2, Trophy, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type StarPerformer,
  type StoreLeaderboardItem,
  useLeaderboard,
} from "@/lib/leaderboardStore";

import { resizeImageToDataUrl } from "@/lib/imageResize";

const ADMIN_PIN = "1234";

const EMPTY_PERFORMER = (): StarPerformer => ({
  id: `star-${Date.now()}`,
  name: "",
  role: "",
  branch: "",
  weekLabel: "Star of the Week",
  imageUrl: "",
  quote: "",
  badgeTitle: "HungerStation Market",
});

const EMPTY_STORE = (rank: number): StoreLeaderboardItem => ({
  id: String(Date.now()),
  rank,
  name: "HungerStation Market",
  branch: "New Branch",
  fulfillmentRate: 98,
  ordersCount: 1000,
  assignment: "",
  pickingTime: "",
  compensationRate: 0,
});

export default function AdminPage({ onBack }: { onBack: () => void }) {
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState("");
  const [activeTab, setActiveTab] = useState<"gallery" | "stores">("gallery");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    starGallery,
    starPerformer,
    topStores,
    updateStarGallery,
    updateStarPerformer,
    updateTopStores,
    resetDefaults,
  } = useLeaderboard();

  // Local state for editing
  const [galleryForm, setGalleryForm] = useState<StarPerformer[]>([...starGallery]);
  const [storesForm, setStoresForm] = useState<StoreLeaderboardItem[]>([...topStores]);

  useEffect(() => setGalleryForm([...starGallery]), [starGallery]);
  useEffect(() => setStoresForm([...topStores]), [topStores]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      setIsAuthenticated(true);
      setPinError("");
    } else {
      setPinError("Invalid PIN. Default is 1234");
    }
  };

  const handleGalleryChange = (index: number, field: keyof StarPerformer, value: string) => {
    setGalleryForm((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleGalleryImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, {
        maxWidth: 1024,
        maxHeight: 1024,
        maxBytes: 480 * 1024,
        quality: 0.85,
      });
      handleGalleryChange(index, "imageUrl", dataUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image processing failed");
    }
  };

  const handleAddPerformer = () => {
    setGalleryForm((prev) => [...prev, EMPTY_PERFORMER()]);
  };

  const handleRemovePerformer = (index: number) => {
    setGalleryForm((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveGallery = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = galleryForm.filter((p) => p.name.trim() || p.imageUrl?.trim());
    updateStarGallery(cleaned);
    if (cleaned[0]) {
      updateStarPerformer(cleaned[0]);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleStoreChange = (index: number, field: keyof StoreLeaderboardItem, value: string | number) => {
    setStoresForm((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddStore = () => {
    setStoresForm((prev) => [...prev, EMPTY_STORE(prev.length + 1)]);
  };

  const handleRemoveStore = (index: number) => {
    setStoresForm((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveStores = (e: React.FormEvent) => {
    e.preventDefault();
    updateTopStores(storesForm);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
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
            className={`admin-tab ${activeTab === "gallery" ? "admin-tab--active" : ""}`}
            onClick={() => setActiveTab("gallery")}
          >
            <Sparkles size={16} /> Star Gallery
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

      {activeTab === "gallery" && (
        <section className="admin-panel">
          <div className="admin-panel__header-row">
            <h2 className="admin-panel__title">Edit Star Gallery</h2>
            <button type="button" onClick={handleAddPerformer} className="admin-add-store-btn">
              <ImagePlus size={16} /> Add Performer
            </button>
          </div>

          <form onSubmit={handleSaveGallery} className="admin-form">
            <div className="admin-gallery">
              {galleryForm.map((performer, i) => (
                <div key={performer.id || i} className="admin-gallery-card">
                  <div className="admin-gallery-card__media">
                    {performer.imageUrl ? (
                      <img src={performer.imageUrl} alt="Preview" />
                    ) : (
                      <div className="admin-gallery-card__placeholder">
                        <ImagePlus size={32} />
                        <span>No image</span>
                      </div>
                    )}
                  </div>

                  <div className="admin-gallery-card__fields">
                    <div className="admin-form__group">
                      <label>Name</label>
                      <input
                        type="text"
                        value={performer.name}
                        onChange={(e) => handleGalleryChange(i, "name", e.target.value)}
                        placeholder="Performer name"
                        required
                      />
                    </div>
                    <div className="admin-form__row">
                      <div className="admin-form__group">
                        <label>Role</label>
                        <input
                          type="text"
                          value={performer.role}
                          onChange={(e) => handleGalleryChange(i, "role", e.target.value)}
                          placeholder="Role"
                        />
                      </div>
                      <div className="admin-form__group">
                        <label>Branch</label>
                        <input
                          type="text"
                          value={performer.branch}
                          onChange={(e) => handleGalleryChange(i, "branch", e.target.value)}
                          placeholder="Branch"
                        />
                      </div>
                    </div>
                    <div className="admin-form__row">
                      <div className="admin-form__group">
                        <label>Badge</label>
                        <input
                          type="text"
                          value={performer.badgeTitle}
                          onChange={(e) => handleGalleryChange(i, "badgeTitle", e.target.value)}
                          placeholder="Badge title"
                        />
                      </div>
                      <div className="admin-form__group">
                        <label>Header</label>
                        <input
                          type="text"
                          value={performer.weekLabel}
                          onChange={(e) => handleGalleryChange(i, "weekLabel", e.target.value)}
                          placeholder="Star label"
                        />
                      </div>
                    </div>
                    <div className="admin-form__group">
                      <label>Photo URL</label>
                      <div className="admin-photo-input">
                        <input
                          type="text"
                          value={performer.imageUrl}
                          onChange={(e) => handleGalleryChange(i, "imageUrl", e.target.value)}
                          placeholder="https://... or upload"
                        />
                        <label className="admin-upload-btn">
                          <Upload size={16} /> Upload
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleGalleryImageUpload(i, e)}
                            className="sr-only"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="admin-form__group">
                      <label>Quote</label>
                      <textarea
                        rows={2}
                        value={performer.quote}
                        onChange={(e) => handleGalleryChange(i, "quote", e.target.value)}
                        placeholder="Inspirational quote"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemovePerformer(i)}
                    className="admin-gallery-card__remove"
                    aria-label="Remove performer"
                    title="Remove performer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {galleryForm.length === 0 && (
              <p className="admin-empty">No performers yet. Click “Add Performer” to start the gallery.</p>
            )}

            <button type="submit" className="admin-save-btn">
              <Save size={18} /> Save Gallery
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
            <div className="admin-stores-table admin-stores-table--extended">
              <div className="admin-stores-table__head">
                <span>Rank</span>
                <span>Branch</span>
                <span>Fulfillment %</span>
                <span>Total Orders</span>
                <span>Assignment</span>
                <span>Picking Time</span>
                <span>Compensation %</span>
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
                    value={store.assignment}
                    onChange={(e) => handleStoreChange(i, "assignment", e.target.value)}
                    placeholder="Assignment"
                  />
                  <input
                    type="text"
                    value={store.pickingTime}
                    onChange={(e) => handleStoreChange(i, "pickingTime", e.target.value)}
                    placeholder="e.g. 10 min"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={store.compensationRate}
                    onChange={(e) => handleStoreChange(i, "compensationRate", parseFloat(e.target.value) || 0)}
                    placeholder="4.5"
                  />
                  <input
                    type="text"
                    value={store.badge || ""}
                    onChange={(e) => handleStoreChange(i, "badge", e.target.value)}
                    placeholder="Badge"
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
