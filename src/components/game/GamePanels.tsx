import { Chess } from "chess.js";
import { getCapturedMaterial, pieceGlyph } from "@/lib/chess/material";
import { useState } from "react";
import { List, Swords, Settings2, Handshake, Flag, Check } from "lucide-react";

export function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/* ── Player card with avatar, ELO, wallet badge and clock (Sleek horizontal style) ── */
export function PlayerCard({
  name,
  color,
  elo,
  wallet,
  timeMs,
  active,
  accent = "emerald",
}: {
  name: string;
  color: "white" | "black";
  elo: number;
  wallet?: string | undefined;
  timeMs: number;
  active: boolean;
  accent?: "emerald" | "rose";
}) {
  const low = timeMs <= 30000;
  const initial = (name || "?").charAt(0).toUpperCase();

  return (
    <div
      className={`surface transition-all ${
        active 
          ? 'ring-2 ring-orange shadow-[0_0_20px_-8px_var(--accent-orange)]' 
          : 'ring-1 ring-line'
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Avatar with active indicator - SMALLER */}
        <div className="relative shrink-0">
          <div
            className={`grid h-11 w-11 place-items-center rounded-full text-base font-bold transition-all ${
              accent === "emerald"
                ? "bg-gradient-to-br from-teal to-blue text-canvas"
                : "bg-gradient-to-br from-rose-500 to-danger-accent text-canvas"
            }`}
          >
            {initial}
          </div>
          {active && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-orange ring-2 ring-[var(--bg-base)]"></span>
            </span>
          )}
        </div>

        {/* Player info - TIGHTER */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="truncate text-sm font-semibold text-ink">{name}</h4>
            <span
              className={`h-2 w-2 shrink-0 rounded-full border ${
                color === "white" ? "border-line-strong bg-ink" : "border-line-strong bg-[var(--bg-base)]"
              }`}
              title={color === "white" ? "White" : "Black"}
            />
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-flex items-center gap-1 rounded bg-[var(--surface-strong)] px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">
              {elo} ELO
            </span>
            {wallet && (
              <span className="truncate rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
                {wallet.slice(0, 4)}…{wallet.slice(-3)}
              </span>
            )}
          </div>
        </div>

        {/* Clock - COMPACT */}
        <div className="shrink-0">
          <div
            className={`min-w-[4.5rem] rounded-lg px-3 py-1.5 text-center font-mono text-lg font-bold tabular-nums transition-all ${
              low
                ? "animate-pulse border-2 border-danger-accent bg-danger-accent/20 text-danger-accent shadow-[0_0_16px_-4px_var(--accent-danger)]"
                : active
                  ? "border-2 border-orange bg-orange-soft text-orange"
                  : "border border-line bg-[var(--surface-strong)] text-ink-muted"
            }`}
          >
            {formatClock(timeMs)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Move list grouped into SAN pairs (Chess.com style) ── */
export function MoveList({ moves }: { moves: { san?: string; from?: string; to?: string }[] }) {
  const rows: { n: number; white?: string; black?: string }[] = [];
  moves.forEach((m, i) => {
    const label = m.san || `${m.from ?? ""}${m.to ?? ""}`;
    const idx = Math.floor(i / 2);
    if (!rows[idx]) rows[idx] = { n: idx + 1 };
    if (i % 2 === 0) rows[idx]!.white = label;
    else rows[idx]!.black = label;
  });

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <List className="mb-3 h-7 w-7 text-ink-faint opacity-60" />
        <p className="text-sm text-ink-faint">No moves yet</p>
      </div>
    );
  }

  const lastMoveIdx = moves.length - 1;
  const lastRow = Math.floor(lastMoveIdx / 2);
  const isLastWhite = lastMoveIdx % 2 === 0;

  return (
    <div className="max-h-[450px] overflow-y-auto pr-1 scrollbar-thin">
      <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-x-1.5 text-sm">
        {rows.map((row, idx) => {
          const isCurrentWhite = idx === lastRow && isLastWhite;
          const isCurrentBlack = idx === lastRow && !isLastWhite && row.black;
          
          return (
            <div key={row.n} className="contents group">
              <span className="py-2 font-mono text-xs font-semibold text-ink-faint">{row.n}.</span>
              <span 
                className={`cursor-pointer rounded-md px-2.5 py-2 font-mono text-ink transition-colors hover:bg-orange-soft hover:text-orange ${
                  isCurrentWhite ? 'bg-orange-soft text-orange font-semibold' : ''
                }`}
              >
                {row.white ?? ""}
              </span>
              <span 
                className={`cursor-pointer rounded-md px-2.5 py-2 font-mono text-ink transition-colors hover:bg-orange-soft hover:text-orange ${
                  isCurrentBlack ? 'bg-orange-soft text-orange font-semibold' : ''
                }`}
              >
                {row.black ?? ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Captured material with point differential (Chess.com compact style) ── */
export function CapturedMaterial({ fen, orientation }: { fen: string; orientation: "white" | "black" }) {
  let summary;
  try {
    summary = getCapturedMaterial(fen);
  } catch {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Swords className="mb-3 h-7 w-7 text-ink-faint opacity-60" />
        <p className="text-sm text-ink-faint">Material unavailable</p>
      </div>
    );
  }

  const myDiff = orientation === "white" ? summary.diff : -summary.diff;
  const mine = orientation === "white" ? summary.byWhite : summary.byBlack;
  const theirs = orientation === "white" ? summary.byBlack : summary.byWhite;
  const myColor = orientation === "white" ? "b" : "w";
  const theirColor = orientation === "white" ? "w" : "b";

  const CapturedRow = ({ 
    label, 
    pieces, 
    color, 
    isPlayer 
  }: { 
    label: string; 
    pieces: string[]; 
    color: "w" | "b";
    isPlayer: boolean;
  }) => (
    <div className={`rounded-xl p-4 ${isPlayer ? 'bg-teal/10 border border-teal/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
        {isPlayer && myDiff > 0 && (
          <span className="rounded-md bg-teal px-2 py-0.5 text-xs font-bold text-canvas">
            +{myDiff}
          </span>
        )}
        {!isPlayer && myDiff < 0 && (
          <span className="rounded-md bg-danger-accent px-2 py-0.5 text-xs font-bold text-canvas">
            +{Math.abs(myDiff)}
          </span>
        )}
      </div>
      <div className="min-h-[2rem] text-2xl leading-none">
        {pieces.length ? (
          pieces.map((p, i) => <span key={i} className="mr-0.5">{pieceGlyph(p, color)}</span>)
        ) : (
          <span className="text-sm text-ink-faint">—</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <CapturedRow label="You captured" pieces={mine} color={myColor} isPlayer={true} />
      <CapturedRow label="Opponent captured" pieces={theirs} color={theirColor} isPlayer={false} />
      
      <div className="surface-inset flex items-center justify-between p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Material Balance</span>
        <span
          className={`font-mono text-lg font-bold ${
            myDiff > 0 ? "text-teal" : myDiff < 0 ? "text-danger-accent" : "text-ink-muted"
          }`}
        >
          {myDiff === 0 ? "Even" : myDiff > 0 ? `+${myDiff}` : myDiff}
        </span>
      </div>
    </div>
  );
}

/* ── Right-hand tabbed panel (Chess.com style) ── */
export function GamePanel({
  fen,
  orientation,
  moves,
  drawOffered,
  onOfferDraw,
  onResign,
  timeControl,
}: {
  fen: string;
  orientation: "white" | "black";
  moves: { san?: string; from?: string; to?: string }[];
  drawOffered: boolean;
  onOfferDraw: () => void;
  onResign: () => void;
  timeControl?: string;
}) {
  const [tab, setTab] = useState<"moves" | "material" | "controls">("moves");
  const tabs = [
    { id: "moves", label: "Moves", icon: List },
    { id: "material", label: "Material", icon: Swords },
    { id: "controls", label: "Controls", icon: Settings2 },
  ] as const;

  return (
    <div className="surface overflow-hidden p-0">
      {/* Tab headers */}
      <div className="border-b border-line">
        <div className="grid grid-cols-3">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-2 px-3 py-3.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                tab === t.id
                  ? "border-b-2 border-orange bg-orange-soft text-orange"
                  : "border-b-2 border-transparent text-ink-faint hover:bg-[var(--surface-strong)] hover:text-ink-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === "moves" && <MoveList moves={moves} />}
        {tab === "material" && <CapturedMaterial fen={fen} orientation={orientation} />}
        {tab === "controls" && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[var(--surface-strong)] p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Game Actions</h4>
              <div className="space-y-2">
                <button
                  onClick={onOfferDraw}
                  disabled={drawOffered}
                  className="w-full rounded-lg border border-amber-accent/40 bg-amber-accent/10 px-4 py-2.5 text-sm font-bold text-amber-accent transition-colors hover:bg-amber-accent/20 disabled:cursor-not-allowed disabled:border-line disabled:bg-[var(--surface-strong)] disabled:text-ink-faint"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {drawOffered ? <Check className="h-4 w-4" /> : <Handshake className="h-4 w-4" />}
                    {drawOffered ? "Draw offered" : "Offer draw"}
                  </span>
                </button>
                <button
                  onClick={onResign}
                  className="w-full rounded-lg border border-danger-accent/40 bg-danger-accent/10 px-4 py-2.5 text-sm font-bold text-danger-accent transition-colors hover:bg-danger-accent/20"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <Flag className="h-4 w-4" />
                    Resign game
                  </span>
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-[var(--surface-strong)] p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Game Info</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted">Turn</span>
                  <span className="font-semibold text-ink">
                    {new Chess(fen).turn() === "w" ? "White" : "Black"}
                  </span>
                </div>
                {timeControl && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-muted">Time Control</span>
                    <span className="font-semibold text-ink">{timeControl}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted">Total Moves</span>
                  <span className="font-semibold text-ink">{moves.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
