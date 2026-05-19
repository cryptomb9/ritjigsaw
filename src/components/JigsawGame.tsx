import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createPieces,
  calculateScore,
  formatDuration,
  getPieceBackground,
  type Piece,
  type PuzzleDefinition,
  type SolveStats,
} from "../lib/puzzle";

type DragState = {
  pieceId: number;
  pointerId: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type JigsawGameProps = {
  puzzle: PuzzleDefinition;
  onSolved(stats: SolveStats): void;
  onReset(): void;
};

export function JigsawGame({ puzzle, onSolved, onReset }: JigsawGameProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [pieces, setPieces] = useState<Piece[]>(() => createPieces(puzzle));
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [wrongSlot, setWrongSlot] = useState<string | null>(null);
  const [solvedStats, setSolvedStats] = useState<SolveStats | null>(null);

  const slots = useMemo(() => {
    return Array.from({ length: puzzle.rows * puzzle.cols }, (_, index) => ({
      row: Math.floor(index / puzzle.cols),
      col: index % puzzle.cols,
    }));
  }, [puzzle.cols, puzzle.rows]);

  const remainingPieces = pieces.filter((piece) => piece.slotRow === null || piece.slotCol === null);
  const placedCount = pieces.length - remainingPieces.length;

  useEffect(() => {
    if (solvedStats) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);

    return () => window.clearInterval(timer);
  }, [solvedStats, startedAt]);

  useEffect(() => {
    if (
      solvedStats ||
      pieces.some((piece) => piece.slotRow !== piece.row || piece.slotCol !== piece.col)
    ) {
      return;
    }

    const completedAt = Date.now();
    const secondsTaken = Math.max(1, Math.floor((completedAt - startedAt) / 1000));
    const stats = {
      moves,
      startedAt,
      completedAt,
      secondsTaken,
      score: calculateScore(puzzle, moves, secondsTaken),
    };

    setSolvedStats(stats);
    setElapsed(stats.secondsTaken);
    onSolved(stats);
  }, [moves, onSolved, pieces, solvedStats, startedAt]);

  useEffect(() => {
    if (!drag) {
      return;
    }

    const activeDrag = drag;

    function onPointerMove(event: PointerEvent) {
      if (event.pointerId !== activeDrag.pointerId) {
        return;
      }

      setDrag((current) =>
        current
          ? {
              ...current,
              x: event.clientX - current.width / 2,
              y: event.clientY - current.height / 2,
            }
          : current,
      );
    }

    function onPointerUp(event: PointerEvent) {
      if (event.pointerId !== activeDrag.pointerId) {
        return;
      }

      dropPiece(event.clientX, event.clientY);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [drag]);

  function startDrag(pieceId: number, event: React.PointerEvent<HTMLButtonElement>) {
    if (solvedStats) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);

    setDrag({
      pieceId,
      pointerId: event.pointerId,
      x: event.clientX - rect.width / 2,
      y: event.clientY - rect.height / 2,
      width: rect.width,
      height: rect.height,
    });
  }

  function dropPiece(clientX: number, clientY: number) {
    if (!drag) {
      return;
    }

    const piece = pieces.find((candidate) => candidate.id === drag.pieceId);

    if (!piece) {
      setDrag(null);
      return;
    }

    const targetSlot = getBoardSlot(clientX, clientY);

    if (targetSlot) {
      setMoves((current) => current + 1);
      setPieces((current) => movePieceToSlot(current, piece.id, targetSlot.row, targetSlot.col));

      if (piece.row !== targetSlot.row || piece.col !== targetSlot.col) {
        setWrongSlot(`${targetSlot.row}:${targetSlot.col}`);
        window.setTimeout(() => setWrongSlot(null), 280);
      }
    } else if (piece.slotRow !== null && piece.slotCol !== null) {
      setMoves((current) => current + 1);
      setPieces((current) =>
        current.map((candidate) =>
          candidate.id === piece.id
            ? { ...candidate, slotRow: null, slotCol: null }
            : candidate,
        ),
      );
    }

    setDrag(null);
  }

  function getBoardSlot(clientX: number, clientY: number): { row: number; col: number } | null {
    const board = boardRef.current;

    if (!board) {
      return null;
    }

    const element = document.elementFromPoint(clientX, clientY);
    const slot = element instanceof HTMLElement ? element.closest<HTMLElement>("[data-slot]") : null;

    if (slot && board.contains(slot)) {
      const row = Number(slot.dataset.row);
      const col = Number(slot.dataset.col);

      if (Number.isInteger(row) && Number.isInteger(col)) {
        return { row, col };
      }
    }

    const rect = board.getBoundingClientRect();
    const insideBoard =
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;

    if (!insideBoard) {
      return null;
    }

    return {
      row: Math.min(puzzle.rows - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * puzzle.rows))),
      col: Math.min(puzzle.cols - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * puzzle.cols))),
    };
  }

  function movePieceToSlot(current: Piece[], pieceId: number, row: number, col: number): Piece[] {
    const dragged = current.find((piece) => piece.id === pieceId);

    if (!dragged) {
      return current;
    }

    const displaced = current.find(
      (piece) => piece.id !== pieceId && piece.slotRow === row && piece.slotCol === col,
    );

    return current.map((piece) => {
      if (piece.id === pieceId) {
        return { ...piece, slotRow: row, slotCol: col };
      }

      if (displaced && piece.id === displaced.id) {
        return {
          ...piece,
          slotRow: dragged.slotRow,
          slotCol: dragged.slotCol,
        };
      }

      return piece;
    });
  }

  function resetGame() {
    setPieces(createPieces(puzzle));
    setMoves(0);
    setStartedAt(Date.now());
    setElapsed(0);
    setDrag(null);
    setWrongSlot(null);
    setSolvedStats(null);
    onReset();
  }

  return (
    <section className="game-layout" aria-label="Jigsaw puzzle">
      <aside className="panel stat-panel" aria-label="Puzzle status">
        <div className="panel-header">
          <span className="eyebrow">Puzzle</span>
          <button className="icon-button" type="button" onClick={resetGame} aria-label="Reset puzzle">
            <RotateCcw size={18} />
          </button>
        </div>

        <div className="art-preview" aria-hidden="true">
          <img src={puzzle.imageUrl} alt="" />
        </div>

        <dl className="stats-grid">
          <div>
            <dt>Placed</dt>
            <dd>
              {placedCount}/{pieces.length}
            </dd>
          </div>
          <div>
            <dt>Moves</dt>
            <dd>{moves}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{formatDuration(elapsed)}</dd>
          </div>
          <div>
            <dt>Grid</dt>
            <dd>
              {puzzle.rows}x{puzzle.cols}
            </dd>
          </div>
        </dl>
      </aside>

      <div className="board-column">
        <div className="board-header">
          <span className="eyebrow">Board</span>
          <span className={solvedStats ? "status-pill success" : "status-pill pending"}>
            {solvedStats ? "Complete" : "Active"}
          </span>
        </div>

        <div
          className="board-grid"
          ref={boardRef}
          style={{
            gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${puzzle.rows}, minmax(0, 1fr))`,
          }}
        >
          {slots.map((slot) => {
            const placed = pieces.find(
              (piece) => piece.slotRow === slot.row && piece.slotCol === slot.col,
            );
            const slotId = `${slot.row}:${slot.col}`;
            const misplaced = placed && (placed.row !== slot.row || placed.col !== slot.col);

            return (
              <div
                className={`board-slot ${wrongSlot === slotId ? "wrong" : ""} ${misplaced ? "misplaced" : ""}`}
                key={slotId}
                aria-label={`Slot ${slot.row + 1}, ${slot.col + 1}`}
                data-slot="true"
                data-row={slot.row}
                data-col={slot.col}
              >
                {placed ? (
                  <button
                    className={`puzzle-piece placed-piece ${drag?.pieceId === placed.id ? "is-dragging" : ""}`}
                    type="button"
                    style={getPieceBackground(puzzle, placed)}
                    onPointerDown={(event) => startDrag(placed.id, event)}
                    aria-label={`Placed puzzle piece ${placed.id + 1}`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="panel pieces-panel" aria-label="Puzzle pieces">
        <div className="panel-header">
          <span className="eyebrow">Pieces</span>
          <span className="data-value">{remainingPieces.length}</span>
        </div>

        <div className="piece-tray">
          {remainingPieces.map((piece) => (
            <button
              className={`puzzle-piece tray-piece ${drag?.pieceId === piece.id ? "is-dragging" : ""}`}
              key={piece.id}
              type="button"
              style={getPieceBackground(puzzle, piece)}
              onPointerDown={(event) => startDrag(piece.id, event)}
              aria-label={`Puzzle piece ${piece.id + 1}`}
            />
          ))}
        </div>
      </aside>

      {drag ? (
        <div
          className="puzzle-piece drag-ghost"
          style={{
            ...getPieceBackground(puzzle, pieces.find((piece) => piece.id === drag.pieceId)!),
            width: drag.width,
            height: drag.height,
            transform: `translate3d(${drag.x}px, ${drag.y}px, 0)`,
          }}
        />
      ) : null}
    </section>
  );
}
