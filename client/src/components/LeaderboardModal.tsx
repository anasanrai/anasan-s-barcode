import { Trophy, X } from "lucide-react";
import StarPerformerCard from "./StarPerformerCard";
import TopStoresLeaderboard from "./TopStoresLeaderboard";
import { useLeaderboard } from "@/lib/leaderboardStore";
import { useLang } from "@/lib/i18n";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenStars: () => void;
}

export default function LeaderboardModal({ isOpen, onClose, onOpenStars }: Props) {
  const { t } = useLang();
  const { starGallery, starPerformer, topStores, offline, week } = useLeaderboard();

  if (!isOpen) return null;

  return (
    <div className="leaderboard-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="leaderboard-modal-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="leaderboard-modal-sheet__header">
          <h2 className="leaderboard-modal-sheet__title">
            <Trophy size={18} className="trophy-gold" /> {t.weeklyLeaderboard}
          </h2>
          <button
            type="button"
            className="leaderboard-modal-sheet__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="leaderboard-modal-sheet__content">
          {offline && week && (
            <div className="leaderboard-offline-hint">
              {t.offlineHint} · {week}
            </div>
          )}
          <StarPerformerCard
            performers={starGallery.length > 0 ? starGallery : [starPerformer]}
            onOpenGallery={onOpenStars}
          />
          {topStores.length > 0 ? (
            <TopStoresLeaderboard stores={topStores} />
          ) : (
            <div className="leaderboard-empty">
              <Trophy size={22} className="trophy-gold" />
              <p>{t.noSubmissions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
