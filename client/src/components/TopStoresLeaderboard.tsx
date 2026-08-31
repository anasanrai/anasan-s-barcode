import { Building2, CheckCircle2, Flame, Trophy } from "lucide-react";
import type { StoreLeaderboardItem } from "@/lib/leaderboardStore";
import { useLang } from "@/lib/i18n";

interface Props {
  stores: StoreLeaderboardItem[];
  className?: string;
}

const rankColors = [
  "rank-badge--gold",
  "rank-badge--silver",
  "rank-badge--bronze",
];

export default function TopStoresLeaderboard({ stores, className = "" }: Props) {
  const { t } = useLang();
  return (
    <aside className={`top-stores-card ${className}`} aria-label={t.topStoresTitle}>
      <div className="top-stores-card__header">
        <div className="top-stores-card__title-row">
          <Trophy size={20} className="trophy-gold" />
          <h2 className="top-stores-card__title">{t.topStoresTitle}</h2>
        </div>
        <span className="top-stores-card__badge">{t.liveRanking}</span>
      </div>

      <div className="top-stores-card__list">
        {stores.map((store, index) => {
          const isTop3 = index < 3;
          const rankClass = rankColors[index] || "rank-badge--default";

          return (
            <div
              key={store.id || index}
              className={`top-stores-card__item ${isTop3 ? "top-stores-card__item--top" : ""}`}
            >
              <div className={`top-stores-card__rank ${rankClass}`}>
                {store.rank || index + 1}
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
                  {store.assignment && (
                    <span className="top-stores-card__assignment">{store.assignment}</span>
                  )}
                  {store.pickingTime && (
                    <span className="top-stores-card__picking-time">{store.pickingTime}</span>
                  )}
                </div>
              </div>

              <div className="top-stores-card__metrics">
                <div className="top-stores-card__rate" title={t.fulfillmentRate}>
                  <CheckCircle2 size={12} className="check-green" />
                  <span>{store.fulfillmentRate}%</span>
                </div>
                <span className="top-stores-card__orders">
                  <Flame size={11} className="flame-orange" />
                  {store.ordersCount.toLocaleString()}
                </span>
                {store.compensationRate > 0 && (
                  <span className="top-stores-card__compensation">
                    {store.compensationRate}%
                  </span>
                )}
                <span className="top-stores-card__score">
                  {(store.performanceScore ?? 0).toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
