import { X } from "lucide-react";
import StarPerformerCard from "./StarPerformerCard";
import TopStoresLeaderboard from "./TopStoresLeaderboard";
import { useLeaderboard } from "@/lib/leaderboardStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function LeaderboardModal({ isOpen, onClose }: Props) {
  const { starPerformer, topStores } = useLeaderboard();

  if (!isOpen) return null;

  return (
    <div className="leaderboard-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="leaderboard-modal-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="leaderboard-modal-sheet__header">
          <h2 className="leaderboard-modal-sheet__title">🏆 Weekly Leaderboard</h2>
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
          <StarPerformerCard performer={starPerformer} />
          <TopStoresLeaderboard stores={topStores} />
        </div>
      </div>
    </div>
  );
}
