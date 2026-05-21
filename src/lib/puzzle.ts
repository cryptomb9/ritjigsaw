import { getAddress, keccak256, toBytes, type Address } from "viem";
import type { CSSProperties } from "react";
import { GENERATED_PUZZLE_MANIFEST } from "../generated/puzzleManifest";

export type PuzzleDefinition = {
  id: bigint;
  title: string;
  imageUrl: string;
  imageAlt: string;
  imageURI: string;
  rows: number;
  cols: number;
  layoutSeed: string;
  layoutHash: `0x${string}`;
};

export type Piece = {
  id: number;
  row: number;
  col: number;
  slotRow: number | null;
  slotCol: number | null;
};

export type SolveStats = {
  moves: number;
  secondsTaken: number;
  score: number;
  startedAt: number;
  completedAt: number;
};

export const DEFAULT_LAYOUT_SEED = "ritual-jigsaw:v1:ritual-placeholder:4x4";

export const DEFAULT_PUZZLE: PuzzleDefinition = {
  id: 1n,
  title: "Ritual Block Puzzle",
  imageUrl: "/puzzles/ritual-placeholder.svg",
  imageAlt: "Ritual themed geometric puzzle artwork",
  imageURI: "ritual-placeholder-v1",
  rows: 4,
  cols: 4,
  layoutSeed: DEFAULT_LAYOUT_SEED,
  layoutHash: keccak256(toBytes(DEFAULT_LAYOUT_SEED)),
};

const PUZZLE_MANIFEST = GENERATED_PUZZLE_MANIFEST;

export const PUZZLES: PuzzleDefinition[] = PUZZLE_MANIFEST.map((puzzle) => ({
  ...puzzle,
  id: BigInt(puzzle.id),
  layoutHash: keccak256(toBytes(puzzle.layoutSeed)),
}));

export function buildCustomLayoutSeed(imageURI: string, rows: number, cols: number): string {
  return `ritual-jigsaw:v1:custom:${imageURI.trim()}:${rows}x${cols}`;
}

export function buildCustomLayoutHash(
  imageURI: string,
  rows: number,
  cols: number,
): `0x${string}` {
  return keccak256(toBytes(buildCustomLayoutSeed(imageURI, rows, cols)));
}

export function resolvePuzzleImageUrl(imageURI: string): string {
  const value = imageURI.trim();

  if (value.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${value.slice("ipfs://".length)}`;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("/")
  ) {
    return value;
  }

  return `/puzzles/${value}`;
}

export function titleFromImageURI(imageURI: string, fallbackId: bigint): string {
  const trimmed = imageURI.trim();

  if (trimmed.length === 0) {
    return `Puzzle #${fallbackId.toString()}`;
  }

  const withoutQuery = trimmed.split("?")[0];
  const segments = withoutQuery.split("/").filter(Boolean);
  const lastSegment = segments.length > 0 ? segments[segments.length - 1] : trimmed;
  const withoutExtension = lastSegment.replace(/\.[a-z0-9]+$/i, "");
  const title = withoutExtension
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return title.length > 0 ? title : `Puzzle #${fallbackId.toString()}`;
}

export function createPieces(puzzle: PuzzleDefinition): Piece[] {
  const pieces: Piece[] = [];

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      pieces.push({
        id: row * puzzle.cols + col,
        row,
        col,
        slotRow: null,
        slotCol: null,
      });
    }
  }

  return shuffle(pieces);
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

export function getPieceBackground(
  puzzle: PuzzleDefinition,
  piece: Piece,
): CSSProperties {
  const x = puzzle.cols === 1 ? 0 : (piece.col / (puzzle.cols - 1)) * 100;
  const y = puzzle.rows === 1 ? 0 : (piece.row / (puzzle.rows - 1)) * 100;

  return {
    backgroundImage: `url(${puzzle.imageUrl})`,
    backgroundSize: `${puzzle.cols * 100}% ${puzzle.rows * 100}%`,
    backgroundPosition: `${x}% ${y}%`,
  };
}

export function buildCompletionHash(params: {
  player: Address;
  puzzleId: bigint;
  layoutHash: `0x${string}`;
  moves: number;
  secondsTaken: number;
  score: number;
  startedAt: number;
  completedAt: number;
}): `0x${string}` {
  const payload = [
    getAddress(params.player),
    params.puzzleId.toString(),
    params.layoutHash,
    params.moves.toString(),
    params.secondsTaken.toString(),
    params.score.toString(),
    params.startedAt.toString(),
    params.completedAt.toString(),
  ].join("|");

  return keccak256(toBytes(payload));
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function calculateScore(
  puzzle: PuzzleDefinition,
  moves: number,
  secondsTaken: number,
): number {
  const base = puzzle.rows * puzzle.cols * 1000;
  const penalty = secondsTaken * 10 + moves * 25;
  return Math.max(1, base - penalty);
}
