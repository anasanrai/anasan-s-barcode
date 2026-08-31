import { ArrowLeft, ImagePlus, LogOut, Save, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch, type AuthSession } from "@/lib/api";
import { resizeImageToDataUrl } from "@/lib/imageResize";
import { useLang } from "@/lib/i18n";

interface Props {
  session: AuthSession;
  onLogout: () => void;
  onBack: () => void;
}

interface MyStoreResponse {
  week: string;
  submission: {
    totalOrders: number;
    pickingMin: number;
    assignmentMin: number;
    fulfillmentRate: number;
    compensationRate: number;
  } | null;
  performer: {
    name: string;
    role: string;
    quote: string;
    badgeTitle: string;
    photo: string | null;
  } | null;
}

export default function ManagerPortal({ session, onLogout, onBack }: Props) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"score" | "performer">("score");

  const [score, setScore] = useState({
    totalOrders: 0,
    pickingMin: 0,
    assignmentMin: 0,
    fulfillmentRate: 0,
    compensationRate: 0,
  });
  const [performerName, setPerformerName] = useState("");
  const [performerRole, setPerformerRole] = useState("");
  const [performerQuote, setPerformerQuote] = useState("");
  const [performerPhoto, setPerformerPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token) return;
    apiFetch<MyStoreResponse>("/my-store", { token: session.token })
      .then((r) => {
        if (r.submission) {
          setScore({
            totalOrders: r.submission.totalOrders,
            pickingMin: r.submission.pickingMin,
            assignmentMin: r.submission.assignmentMin,
            fulfillmentRate: r.submission.fulfillmentRate,
            compensationRate: r.submission.compensationRate,
          });
        }
        if (r.performer) {
          setPerformerName(r.performer.name);
          setPerformerRole(r.performer.role);
          setPerformerQuote(r.performer.quote);
          setPerformerPhoto(r.performer.photo);
        }
      })
      .catch(() => toast.error(t.loadFailed));
  }, [session.token, t]);

  const handleSaveScore = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/my-store/metrics", {
        method: "PUT",
        token: session.token,
        body: score,
      });
      toast.success(t.savedOk);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, {
        maxWidth: 1024,
        maxHeight: 1024,
        maxBytes: 200 * 1024,
        quality: 0.85,
      });
      setPerformerPhoto(dataUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image processing failed");
    }
  };

  const handleSavePerformer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!performerName.trim()) {
      toast.error(t.performerNameRequired);
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/my-store/performer", {
        method: "PUT",
        token: session.token,
        body: {
          name: performerName,
          role: performerRole,
          quote: performerQuote,
          photo: performerPhoto,
        },
      });
      toast.success(t.savedOk);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-header">
        <button type="button" onClick={onBack} className="admin-back-btn">
          <ArrowLeft size={18} /> {t.backToApp}
        </button>

        <div className="admin-header__tabs">
          <button
            type="button"
            className={`admin-tab ${activeTab === "score" ? "admin-tab--active" : ""}`}
            onClick={() => setActiveTab("score")}
          >
            {t.myStoreScore}
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === "performer" ? "admin-tab--active" : ""}`}
            onClick={() => setActiveTab("performer")}
          >
            {t.myPerformer}
          </button>
        </div>

        <button type="button" onClick={onLogout} className="admin-reset-btn">
          <LogOut size={14} /> {t.logout}
        </button>
      </header>

      <div className="admin-store-banner">
        {session.storeName}
        {session.storeBranch ? ` — ${session.storeBranch}` : ""}
      </div>

      {activeTab === "score" && (
        <section className="admin-panel">
          <h2 className="admin-panel__title">{t.weeklyScoreTitle}</h2>
          <form onSubmit={handleSaveScore} className="admin-form">
            <div className="admin-form__row">
              <div className="admin-form__group">
                <label>{t.totalOrdersLabel}</label>
                <input
                  type="number"
                  min={0}
                  value={score.totalOrders}
                  onChange={(e) => setScore((s) => ({ ...s, totalOrders: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div className="admin-form__group">
                <label>{t.pickingTimeLabel} (min)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={score.pickingMin}
                  onChange={(e) => setScore((s) => ({ ...s, pickingMin: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div className="admin-form__group">
                <label>{t.assignmentTimeLabel} (min)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={score.assignmentMin}
                  onChange={(e) => setScore((s) => ({ ...s, assignmentMin: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
            </div>
            <div className="admin-form__row">
              <div className="admin-form__group">
                <label>{t.fulfillmentRate} (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={score.fulfillmentRate}
                  onChange={(e) => setScore((s) => ({ ...s, fulfillmentRate: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div className="admin-form__group">
                <label>{t.compensationRateLabel} (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={score.compensationRate}
                  onChange={(e) => setScore((s) => ({ ...s, compensationRate: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
            </div>
            <button type="submit" className="admin-save-btn" disabled={busy}>
              <Save size={18} /> {t.saveScore}
            </button>
          </form>
        </section>
      )}

      {activeTab === "performer" && (
        <section className="admin-panel">
          <h2 className="admin-panel__title">{t.performerWeekTitle}</h2>
          <form onSubmit={handleSavePerformer} className="admin-form">
            <div className="admin-form__row">
              <div className="admin-form__group">
                <label>{t.performerNameLabel}</label>
                <input
                  type="text"
                  value={performerName}
                  onChange={(e) => setPerformerName(e.target.value)}
                  placeholder={t.performerNamePlaceholder}
                  required
                />
              </div>
              <div className="admin-form__group">
                <label>{t.roleLabel}</label>
                <input
                  type="text"
                  value={performerRole}
                  onChange={(e) => setPerformerRole(e.target.value)}
                  placeholder={t.rolePlaceholder}
                />
              </div>
            </div>
            <div className="admin-form__group">
              <label>{t.quoteLabel}</label>
              <textarea
                rows={2}
                value={performerQuote}
                onChange={(e) => setPerformerQuote(e.target.value)}
                placeholder={t.quotePlaceholder}
              />
            </div>
            <div className="admin-form__group">
              <label>{t.photoLabel}</label>
              <div className="admin-photo-input">
                <div className="manager-photo-preview">
                  {performerPhoto ? (
                    <img src={performerPhoto} alt="Preview" />
                  ) : (
                    <ImagePlus size={32} />
                  )}
                </div>
                <label className="admin-upload-btn">
                  <Upload size={16} /> {t.uploadPhoto}
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="sr-only" />
                </label>
              </div>
            </div>
            <button type="submit" className="admin-save-btn" disabled={busy}>
              <Save size={18} /> {t.savePerformer}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
