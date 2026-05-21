import { Puzzle, Trophy, Wallet } from "lucide-react";
import type { Address } from "viem";
import { hasPuzzleContract, puzzleContractAddress, shortAddress } from "../lib/ritual";
import { MusicControl } from "./MusicControl";

type WalletPanelProps = {
  address: Address | null;
  balance: string | null;
  busy: boolean;
  error: string | null;
  warning: string | null;
  activeView: "game" | "leaderboard";
  onConnect(): void;
  onEnsureRitual(): void;
  onShowGame(): void;
  onShowLeaderboard(): void;
};

export function WalletPanel({
  address,
  balance,
  busy,
  error,
  warning,
  activeView,
  onConnect,
  onEnsureRitual,
  onShowGame,
  onShowLeaderboard,
}: WalletPanelProps) {
  const contractReady = hasPuzzleContract();

  return (
    <section className="top-panel" aria-label="Wallet and network status">
      <div className="brand-block">
        <span className="eyebrow">Ritual Chain</span>
        <h1>Ritual Block Puzzle</h1>
      </div>

      <div className="connection-strip">
        <button
          className={`connection-item nav-tile ${activeView === "leaderboard" ? "active" : ""}`}
          type="button"
          onClick={activeView === "leaderboard" ? onShowGame : onShowLeaderboard}
        >
          {activeView === "leaderboard" ? <Puzzle size={18} /> : <Trophy size={18} />}
          <div>
            <span>{activeView === "leaderboard" ? "View" : "Open"}</span>
            <strong>{activeView === "leaderboard" ? "Game" : "Leaderboard"}</strong>
          </div>
        </button>

        <MusicControl />

        <div className="connection-item">
          <Wallet size={18} />
          <div>
            <span>Wallet</span>
            <strong>{address ? shortAddress(address) : "Disconnected"}</strong>
          </div>
        </div>

        <div className="connection-item">
          <span className={`dot ${contractReady ? "green" : "gold"}`} />
          <div>
            <span>Contract</span>
            <strong>
              {contractReady && puzzleContractAddress
                ? shortAddress(puzzleContractAddress)
                : "Not set"}
            </strong>
          </div>
        </div>

        <div className="balance-box">
          <span>Balance</span>
          <strong>{balance ? `${balance} RITUAL` : "-"}</strong>
        </div>

        <button className="primary-button" type="button" onClick={onConnect} disabled={busy}>
          <Wallet size={18} />
          {busy ? "Connecting" : address ? "Refresh" : "Connect"}
        </button>
      </div>

      {warning ? (
        <div className="inline-alert neutral alert-row">
          <span>{warning}</span>
          <button className="secondary-button" type="button" onClick={onEnsureRitual} disabled={busy}>
            Add Ritual
          </button>
        </div>
      ) : null}
      {error ? <p className="inline-alert danger">{error}</p> : null}
    </section>
  );
}
