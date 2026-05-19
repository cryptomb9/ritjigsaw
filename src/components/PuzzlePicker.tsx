import { ChevronDown, Images } from "lucide-react";
import { useState } from "react";
import type { PuzzleDefinition } from "../lib/puzzle";

type PuzzlePickerProps = {
  puzzles: PuzzleDefinition[];
  activePuzzle: PuzzleDefinition;
  onSelect(puzzle: PuzzleDefinition): void;
};

export function PuzzlePicker({ puzzles, activePuzzle, onSelect }: PuzzlePickerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="panel puzzle-picker" aria-label="Puzzle selection">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Images</span>
          <h2>Select puzzle</h2>
        </div>
        <span className="data-value">{puzzles.length}</span>
      </div>

      <button
        className="puzzle-select-toggle"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <img src={activePuzzle.imageUrl} alt="" />
        <span>
          <span className="eyebrow">Selected</span>
          <strong>{activePuzzle.title}</strong>
        </span>
        <Images size={18} />
        <ChevronDown className={expanded ? "rotated" : ""} size={18} />
      </button>

      <div className={`puzzle-options ${expanded ? "expanded" : ""}`}>
        {puzzles.map((puzzle) => {
          const active = puzzle.layoutHash === activePuzzle.layoutHash;

          return (
            <button
              className={`puzzle-option ${active ? "active" : ""}`}
              key={puzzle.layoutHash}
              type="button"
              onClick={() => {
                onSelect(puzzle);
                setExpanded(false);
              }}
            >
              <img src={puzzle.imageUrl} alt="" />
              <span>{puzzle.title}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
