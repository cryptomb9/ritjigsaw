import { CheckCircle2, ExternalLink, Loader2, Send, TriangleAlert } from "lucide-react";
import type { Hash } from "viem";
import { explorerTxUrl, hasPuzzleContract } from "../lib/ritual";
import { formatDuration, type SolveStats } from "../lib/puzzle";

export type SubmitPhase = "idle" | "ready" | "wallet" | "chain" | "confirmed" | "error";

type CompletionPanelProps = {
  stats: SolveStats | null;
  phase: SubmitPhase;
  txHash: Hash | null;
  message: string | null;
  walletConnected: boolean;
  onSubmit(): void;
};

export function CompletionPanel({
  stats,
  phase,
  txHash,
  message,
  walletConnected,
  onSubmit,
}: CompletionPanelProps) {
  const contractReady = hasPuzzleContract();
  const canSubmit = Boolean(stats && walletConnected && contractReady && phase !== "wallet" && phase !== "chain");
  const isBusy = phase === "wallet" || phase === "chain";

  return (
    <section className="submit-panel" aria-label="Completion submission">
      <div className="submit-status" role="status" aria-live="polite">
        {phase === "confirmed" ? <CheckCircle2 size={20} /> : null}
        {phase === "error" ? <TriangleAlert size={20} /> : null}
        {isBusy ? <Loader2 className="spin" size={20} /> : null}
        {phase === "idle" || phase === "ready" ? <Send size={20} /> : null}

        <div>
          <span className="eyebrow">Completion</span>
          <strong>{statusText(phase, stats)}</strong>
        </div>
      </div>

      <dl className="completion-stats">
        <div>
          <dt>Moves</dt>
          <dd>{stats ? stats.moves : "-"}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{stats ? formatDuration(stats.secondsTaken) : "-"}</dd>
        </div>
        <div>
          <dt>Points</dt>
          <dd>{stats ? stats.score.toLocaleString() : "-"}</dd>
        </div>
      </dl>

      <button className="primary-button wide" type="button" onClick={onSubmit} disabled={!canSubmit}>
        <Send size={18} />
        <span className="submit-label-full">Submit Completion</span>
        <span className="submit-label-short">Submit</span>
      </button>

      {message ? <p className={`inline-alert ${phase === "error" ? "danger" : "neutral"}`}>{message}</p> : null}

      {txHash ? (
        <a className="tx-link" href={explorerTxUrl(txHash)} target="_blank" rel="noreferrer">
          <ExternalLink size={16} />
          {txHash.slice(0, 10)}...{txHash.slice(-8)}
        </a>
      ) : null}
    </section>
  );
}

function statusText(phase: SubmitPhase, stats: SolveStats | null): string {
  if (!stats) {
    return "Unsolved";
  }

  if (phase === "wallet") {
    return "Wallet confirmation";
  }

  if (phase === "chain") {
    return "Confirming on Ritual";
  }

  if (phase === "confirmed") {
    return "Recorded on-chain";
  }

  if (phase === "error") {
    return "Submission failed";
  }

  return "Ready";
}
