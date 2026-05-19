import { Trophy } from "lucide-react";
import type { LeaderboardEntry } from "../lib/ritual";
import { hasPuzzleContract, shortAddress } from "../lib/ritual";

type LeaderboardProps = {
  entries: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  page?: boolean;
  onRefresh(): void;
};

export function Leaderboard({ entries, loading, error, page = false, onRefresh }: LeaderboardProps) {
  const contractReady = hasPuzzleContract();

  return (
    <section className={`panel leaderboard-panel ${page ? "leaderboard-page" : ""}`} aria-label="Leaderboard">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Leaderboard</span>
          <h2>Top 30</h2>
        </div>
        <button className="icon-button" type="button" onClick={onRefresh} disabled={loading}>
          <Trophy size={18} />
        </button>
      </div>

      {!contractReady ? (
        <p className="muted-copy">Set the contract address on Vercel to load on-chain points.</p>
      ) : null}

      {error ? <p className="inline-alert danger">{error}</p> : null}

      <div className="leaderboard-list">
        {entries.length > 0 ? (
          <div className="leaderboard-heading" aria-hidden="true">
            <span>#</span>
            <span>Address</span>
            <span>Total points</span>
          </div>
        ) : null}

        {entries.length === 0 ? (
          <p className="muted-copy">{loading ? "Loading leaderboard." : "No scores recorded yet."}</p>
        ) : (
          entries.map((entry) => (
            <div className="leaderboard-row" key={entry.address}>
              <span className="rank">{entry.rank}</span>
              <span className="player-address">{shortAddress(entry.address)}</span>
              <strong>{entry.points.toLocaleString()}</strong>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
