import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { Address, Hash } from "viem";
import { CompletionPanel, type SubmitPhase } from "./components/CompletionPanel";
import { JigsawGame } from "./components/JigsawGame";
import { Leaderboard } from "./components/Leaderboard";
import { PuzzlePicker } from "./components/PuzzlePicker";
import { WalletPanel } from "./components/WalletPanel";
import {
  buildCompletionHash,
  PUZZLES,
  type PuzzleDefinition,
  type SolveStats,
} from "./lib/puzzle";
import {
  addOrSwitchRitualChain,
  connectWallet,
  getNativeBalance,
  getTopLeaderboard,
  type LeaderboardEntry,
  waitForCompletionReceipt,
  writeScore,
} from "./lib/ritual";

export default function App() {
  const [activeView, setActiveView] = useState<"game" | "leaderboard">("game");
  const [gameStarted, setGameStarted] = useState(false);
  const [activePuzzle, setActivePuzzle] = useState<PuzzleDefinition>(PUZZLES[0]);
  const [address, setAddress] = useState<Address | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletWarning, setWalletWarning] = useState<string | null>(null);
  const [solveStats, setSolveStats] = useState<SolveStats | null>(null);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const playablePuzzles = useMemo(() => PUZZLES, []);

  const refreshWallet = useCallback(async (walletAddress: Address) => {
    const nextBalance = await getNativeBalance(walletAddress);
    setBalance(nextBalance);
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);

    try {
      const entries = await getTopLeaderboard();
      setLeaderboard(entries);
    } catch (error) {
      setLeaderboardError(error instanceof Error ? error.message : "Could not load leaderboard.");
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLeaderboard();
  }, [refreshLeaderboard]);

  async function handleConnect() {
    setWalletBusy(true);
    setWalletError(null);
    setWalletWarning(null);

    try {
      const result = await connectWallet();
      setAddress(result.address);
      setWalletWarning(result.chainReady ? null : result.chainError);
      await refreshWallet(result.address);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Wallet connection failed.");
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleAddRitual() {
    setWalletBusy(true);
    setWalletError(null);

    try {
      await addOrSwitchRitualChain();
      setWalletWarning(null);

      if (address) {
        await refreshWallet(address);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add Ritual Chain.";
      setWalletWarning(`Ritual network setup failed: ${message}`);
    } finally {
      setWalletBusy(false);
    }
  }

  function handleSolved(stats: SolveStats) {
    setSolveStats(stats);
    setSubmitPhase("ready");
    setSubmitMessage(`Puzzle solved for ${stats.score.toLocaleString()} points.`);
  }

  function handleReset() {
    setSolveStats(null);
    setSubmitPhase("idle");
    setSubmitMessage(null);
    setTxHash(null);
  }

  function handlePuzzleSelect(puzzle: PuzzleDefinition) {
    setActivePuzzle(puzzle);
    handleReset();
    setGameStarted(true);
  }

  useEffect(() => {
    const currentPuzzleIsPlayable = playablePuzzles.some(
      (puzzle) => puzzle.layoutHash === activePuzzle.layoutHash,
    );

    if (!currentPuzzleIsPlayable) {
      setActivePuzzle(playablePuzzles[0]);
      handleReset();
    }
  }, [activePuzzle.layoutHash, playablePuzzles]);

  function showLeaderboard() {
    setActiveView("leaderboard");
    void refreshLeaderboard();
  }

  async function handleSubmit() {
    if (!address || !solveStats) {
      return;
    }

    try {
      setSubmitPhase("chain");
      setSubmitMessage("Checking solved puzzle.");

      const completionHash = buildCompletionHash({
        player: address,
        puzzleId: activePuzzle.id,
        layoutHash: activePuzzle.layoutHash,
        moves: solveStats.moves,
        secondsTaken: solveStats.secondsTaken,
        score: solveStats.score,
        startedAt: solveStats.startedAt,
        completedAt: solveStats.completedAt,
      });

      setSubmitPhase("wallet");
      setSubmitMessage("Approve the completion transaction in your wallet.");

      const hash = await writeScore({
        player: address,
        puzzleHash: activePuzzle.layoutHash,
        rows: activePuzzle.rows,
        cols: activePuzzle.cols,
        moves: solveStats.moves,
        secondsTaken: solveStats.secondsTaken,
        completionHash,
      });

      setTxHash(hash);
      setSubmitPhase("chain");
      setSubmitMessage("Transaction sent. Waiting for Ritual confirmation.");

      const receipt = await waitForCompletionReceipt(hash);

      if (receipt.status !== "success") {
        throw new Error("Ritual transaction reverted.");
      }

      setSubmitPhase("confirmed");
      setSubmitMessage("Completion proof is now stored on Ritual Chain.");
      await refreshWallet(address);
      await refreshLeaderboard();
    } catch (error) {
      setSubmitPhase("error");
      setSubmitMessage(error instanceof Error ? error.message : "Completion submission failed.");
    }
  }

  return (
    <main className={`app-shell ${gameStarted && activeView === "game" ? "in-game-room" : ""}`}>
      <WalletPanel
        address={address}
        balance={balance}
        busy={walletBusy}
        error={walletError}
        warning={walletWarning}
        activeView={activeView}
        onConnect={handleConnect}
        onEnsureRitual={handleAddRitual}
        onShowGame={() => setActiveView("game")}
        onShowLeaderboard={showLeaderboard}
      />

      {activeView === "leaderboard" ? (
        <Leaderboard
          entries={leaderboard}
          loading={leaderboardLoading}
          error={leaderboardError}
          onRefresh={refreshLeaderboard}
          page
        />
      ) : !gameStarted ? (
        <div className="selection-screen">
          <div className="selection-copy">
            <span className="eyebrow">Select Puzzle</span>
            <h2>Choose an image to enter the game room</h2>
          </div>
          <PuzzlePicker
            puzzles={playablePuzzles}
            activePuzzle={activePuzzle}
            onSelect={handlePuzzleSelect}
          />
        </div>
      ) : (
        <div className="game-room">
          <div className="game-room-bar">
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setGameStarted(false);
                handleReset();
              }}
            >
              <ArrowLeft size={16} />
              Puzzles
            </button>
            <span className="orientation-hint">Rotate your phone for the full game room.</span>
          </div>
          <JigsawGame
            key={activePuzzle.layoutHash}
            puzzle={activePuzzle}
            onSolved={handleSolved}
            onReset={handleReset}
          />

          <CompletionPanel
            stats={solveStats}
            phase={submitPhase}
            txHash={txHash}
            message={submitMessage}
            walletConnected={Boolean(address)}
            onSubmit={handleSubmit}
          />
        </div>
      )}

      <footer className="site-credit">Made by Lia</footer>
    </main>
  );
}
