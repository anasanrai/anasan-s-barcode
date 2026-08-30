import { Building2, CheckCircle2, Flame, Trophy } from "lucide-react";
import type { StoreLeaderboardItem } from "@/lib/leaderboardStore";

interface Props {
  stores: StoreLeaderboardItem[];
  className?: string;
}

export default function TopStoresLeaderboard({ stores, className = "" }: Props) {
  return (
    <aside className={`top-stores-card ${className}`} aria-label="Top 10 Performing Stores">
      <div className="top-stores-card__header">
        <div className="top-stores-card__title-row">
          <Trophy size={20} className="trophy-gold" />
          <h2 className="top-stores-card__title">Top 10 Stores</h2>
        </div>
        <span className="top-stores-card__badge">Live Ranking</span>
      </div>

      <div className="top-stores-card__list">
        {stores.map((store, index) => {
          const isTop3 = index < 3;
          const rankColors = [
            "rank-badge--gold",
            "rank-badge--silver",
            "rank-badge--bronze",
          ];
          const rankClass = rankColors[index] || "rank-badge--default";

          return (
            <div
              key={store.id || index}
              className={`top-stores-card__item ${isTop3 ? "top-stores-card__item--top" : ""}`}
            >
              <div className={`top-stores-card__rank ${rankClass}`}>
                {index === 0 ? "1" : index === 1 ? "2" : index === 2 ? "3" : store.rank || index + 1}
              </div>

              <div className="top-stores-card__info">
                <div className="top-stores-card__name-row">
                  <span className="top-stores-card__branch">{store.branch}</span>
                  {store.badge && (
                    <span className="top-stores-card__item-badge">{store.badge}</span>
                  )}
                </div>
                <div className="top-stores-card__sub-row">
                  <span className="top-stores-card__store-name">
                    <Building2 size={12} /> {store.name}
                  </span>
                </div>
              </div>

              <div className="top-stores-card__metrics">
                <div className="top-stores-card__rate" title="Fulfillment Rate">
                  <CheckCircle2 size={12} className="check-green" />
                  <span>{store.fulfillmentRate}%</span>
                </div>
                {store.ordersCount > 0 && (
                  <span className="top-stores-card__orders">
                    <Flame size={11} className="flame-orange" />
                    {store.ordersCount.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
