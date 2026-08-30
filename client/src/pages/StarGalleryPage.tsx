import { ArrowLeft, Trophy, User } from "lucide-react";
import { useLeaderboard } from "@/lib/leaderboardStore";
import { useLang } from "@/lib/i18n";

interface Props {
  onBack: () => void;
}

export default function StarGalleryPage({ onBack }: Props) {
  const { t } = useLang();
  const { starGallery, starPerformer } = useLeaderboard();

  const performers = starGallery.length > 0 ? starGallery : [starPerformer];

  return (
    <main className="star-gallery-page">
      <header className="star-gallery-page__header">
        <button type="button" className="admin-back-btn" onClick={onBack}>
          <ArrowLeft size={18} /> {t.backToApp}
        </button>
        <h1 className="star-gallery-page__title">
          <Trophy size={20} className="trophy-gold" /> {t.starGalleryTitle}
        </h1>
        <span className="star-gallery-page__count">
          {performers.length} {performers.length === 1 ? t.starSingular : t.starPlural}
        </span>
      </header>

      <section className="star-gallery-page__grid">
        {performers.map((performer) => (
          <article key={performer.id} className="star-gallery-card">
            <div className="star-gallery-card__media">
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
