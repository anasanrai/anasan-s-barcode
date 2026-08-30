import { ArrowLeft, ClipboardList, Package, Timer, Trophy, User } from "lucide-react";
import { useMemo, useState } from "react";
import {
  calculatePerformerScore,
  type PerformerSortKey,
  sortPerformers,
  useLeaderboard,
} from "@/lib/leaderboardStore";
import { useLang } from "@/lib/i18n";

interface Props {
  onBack: () => void;
}

export default function StarGalleryPage({ onBack }: Props) {
  const { t } = useLang();
  const { starGallery, starPerformer } = useLeaderboard();
  const [sortKey, setSortKey] = useState<PerformerSortKey>("score");

  const baseList = starGallery.length > 0 ? starGallery : [starPerformer];
  const performers = useMemo(() => sortPerformers(baseList, sortKey), [baseList, sortKey]);

  return (
    <main className="star-gallery-page">
      <header className="star-gallery-page__header">
        <button type="button" className="admin-back-btn" onClick={onBack}>
          <ArrowLeft size={18} /> {t.backToApp}
        </button>
        <h1 className="star-gallery-page__title">
          <Trophy size={20} className="trophy-gold" /> {t.starGalleryTitle}
        </h1>
        <div className="star-gallery-page__controls">
          <select
            className="star-gallery-page__sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as PerformerSortKey)}
            aria-label={t.sortBy}
          >
            <option value="score">{t.sortByScore}</option>
            <option value="orders">{t.totalOrdersLabel}</option>
            <option value="picking">{t.pickingTimeLabel}</option>
            <option value="assignment">{t.assignmentTimeLabel}</option>
          </select>
          <span className="star-gallery-page__count">
            {performers.length} {performers.length === 1 ? t.starSingular : t.starPlural}
          </span>
        </div>
      </header>

      <section className="star-gallery-page__grid">
        {performers.map((performer, index) => (
          <article key={performer.id} className="star-gallery-card">
            <div className="star-gallery-card__media">
              <span className={`star-gallery-card__rank ${index < 3 ? `star-gallery-card__rank--${index}` : ""}`}>
                #{index + 1}
              </span>
              {performer.imageUrl ? (
                <img
                  src={performer.imageUrl}
                  alt={performer.name}
                  className="star-gallery-card__img"
                />
              ) : (
                <div className="star-gallery-card__placeholder">
                  <User size={40} className="trophy-gold" />
                </div>
              )}
            </div>
            <div className="star-gallery-card__body">
              <span className="star-gallery-card__badge">{performer.badgeTitle}</span>
              <h2 className="star-gallery-card__name">{performer.name}</h2>
              <p className="star-gallery-card__role">{performer.role}</p>
              <p className="star-gallery-card__branch">{performer.branch}</p>
              <div className="star-gallery-card__stats">
                <span className="star-gallery-card__stat" title={t.totalOrdersLabel}>
                  <Package size={12} /> {performer.totalOrders.toLocaleString()}
                </span>
                <span className="star-gallery-card__stat" title={t.pickingTimeLabel}>
                  <Timer size={12} /> {performer.pickingTime} min
                </span>
                <span className="star-gallery-card__stat" title={t.assignmentTimeLabel}>
                  <ClipboardList size={12} /> {performer.assignmentTime} min
                </span>
                <span className="star-gallery-card__stat star-gallery-card__stat--score">
                  {calculatePerformerScore(performer, baseList).toFixed(1)}
                </span>
              </div>
              {performer.quote && (
                <blockquote className="star-gallery-card__quote">"{performer.quote}"</blockquote>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
