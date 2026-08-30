import { Award, Crown, MapPin, Sparkles, Star, Trophy } from "lucide-react";
import type { StarPerformer } from "@/lib/leaderboardStore";
import { useLang } from "@/lib/i18n";

interface Props {
  performer: StarPerformer;
  className?: string;
}

export default function StarPerformerCard({ performer, className = "" }: Props) {
  const { t } = useLang();
  return (
    <aside className={`star-performer-card ${className}`} aria-label="Star of the Week">
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
      <div className="star-performer-card__avatar-wrap">
        <div className="star-performer-card__wreath" />
        {performer.imageUrl ? (
          <img
            src={performer.imageUrl}
            alt={performer.name}
            className="star-performer-card__img"
          />
        ) : (
          <div className="star-performer-card__avatar-placeholder">
            <Trophy size={48} className="trophy-gold" />
          </div>
        )}
        <div className="star-performer-card__crown">
          <Crown size={22} fill="#FFB800" color="#FFB800" />
        </div>
      </div>

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
