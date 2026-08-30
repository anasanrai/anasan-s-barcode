import { Award, Crown, MapPin, Sparkles, Star, Trophy, User } from "lucide-react";
import { useEffect, useState } from "react";
import type { StarPerformer } from "@/lib/leaderboardStore";
import { useLang } from "@/lib/i18n";

interface Props {
  performers: StarPerformer[];
  onOpenGallery?: () => void;
  className?: string;
}

export default function StarPerformerCard({ performers, onOpenGallery, className = "" }: Props) {
  const { t } = useLang();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (performers.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % performers.length);
    }, 4000);
    return () => clearInterval(id);
  }, [performers.length]);

  useEffect(() => {
    setIndex(0);
  }, [performers.length]);

  const performer = performers[index] ?? performers[0];
  if (!performer) return null;

  return (
    <aside className={`star-performer-card ${className}`} aria-label={t.starOfTheWeek}>
      <div className="star-performer-card__glow" />

      {/* Header Banner */}
      <div className="star-performer-card__header">
        <div className="star-performer-card__brand">
          <span className="star-performer-card__brand-tag">{performer.badgeTitle}</span>
        </div>
        <div className="star-performer-card__branch">
          <MapPin size={13} />
          <span>{performer.branch}</span>
        </div>
      </div>

      {/* Main Title Badge */}
      <div className="star-performer-card__title-wrap">
        <Star className="star-icon star-icon--left" size={20} fill="#FFB800" color="#FFB800" />
        <h2 className="star-performer-card__title">{performer.weekLabel}</h2>
        <Star className="star-icon star-icon--right" size={20} fill="#FFB800" color="#FFB800" />
      </div>

      {/* Avatar / Photo */}
      <button
        type="button"
        className="star-performer-card__avatar-btn"
        onClick={onOpenGallery}
        aria-label={t.viewAllStars}
        title={t.viewAllStars}
      >
        <div className="star-performer-card__avatar-ring">
          {performer.imageUrl ? (
            <img
              src={performer.imageUrl}
              alt={performer.name}
              className="star-performer-card__img"
            />
          ) : (
            <div className="star-performer-card__avatar-placeholder">
              <User size={48} className="trophy-gold" />
            </div>
          )}
        </div>
        <div className="star-performer-card__crown">
          <Crown size={22} fill="#FFB800" color="#FFB800" />
        </div>
        {performers.length > 1 && (
          <span className="star-performer-card__counter">
            {index + 1} / {performers.length}
          </span>
        )}
      </button>

      {/* Name and Role */}
      <div className="star-performer-card__name-badge">
        <h3 className="star-performer-card__name">{performer.name}</h3>
        <p className="star-performer-card__role">{performer.role}</p>
      </div>

      {/* Star Rating Strip */}
      <div className="star-performer-card__stars" aria-hidden="true">
        {[...Array(7)].map((_, i) => (
          <Star key={i} size={14} fill="#FFB800" color="#FFB800" />
        ))}
      </div>

      {/* Quote Banner */}
      {performer.quote && (
        <blockquote className="star-performer-card__quote">
          <Sparkles size={14} className="sparkle-icon" />
          <span>"{performer.quote}"</span>
        </blockquote>
      )}

      {/* Bottom Tagline */}
      <div className="star-performer-card__footer">
        <Award size={14} />
        <span>{t.starFooter.toUpperCase()}</span>
      </div>
    </aside>
  );
}
