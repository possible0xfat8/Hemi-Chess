import { Chess } from "chess.js";

export const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const START_COUNTS: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

export type CapturedSummary = {
  /** pieces captured BY white (i.e. missing black pieces) */
  byWhite: string[];
  /** pieces captured BY black (i.e. missing white pieces) */
  byBlack: string[];
  /** positive => white is up material */
  diff: number;
};

export function getCapturedMaterial(fen: string): CapturedSummary {
  const board = new Chess(fen).board();
  const counts: Record<"w" | "b", Record<string, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };

  for (const row of board) {
    for (const square of row) {
      if (square) {
        const bucket = counts[square.color];
        bucket[square.type] = (bucket[square.type] ?? 0) + 1;
      }
    }
  }


  const byWhite: string[] = [];
  const byBlack: string[] = [];
  let diff = 0;

  for (const type of ["q", "r", "b", "n", "p"]) {
    const start = START_COUNTS[type] ?? 0;
    const missingBlack = Math.max(0, start - (counts.b[type] ?? 0));
    const missingWhite = Math.max(0, start - (counts.w[type] ?? 0));
    for (let i = 0; i < missingBlack; i++) byWhite.push(type);
    for (let i = 0; i < missingWhite; i++) byBlack.push(type);
    diff += (missingBlack - missingWhite) * (PIECE_VALUES[type] ?? 0);
  }

  return { byWhite, byBlack, diff };
}

const GLYPHS: Record<string, { w: string; b: string }> = {
  p: { w: "♙", b: "♟" },
  n: { w: "♘", b: "♞" },
  b: { w: "♗", b: "♝" },
  r: { w: "♖", b: "♜" },
  q: { w: "♕", b: "♛" },
  k: { w: "♔", b: "♚" },
};

export function pieceGlyph(type: string, color: "w" | "b") {
  return GLYPHS[type]?.[color] ?? "";
}
