import { useEffect, useState } from "react";
import { Search } from "lucide-react";

export const TIME_CONTROLS = [
  { id: "blitz3", label: "3 min", sub: "Blitz", ms: 180000 },
  { id: "blitz5", label: "5 min", sub: "Blitz", ms: 300000 },
  { id: "rapid10", label: "10 min", sub: "Rapid", ms: 600000 },
  { id: "classic30", label: "30 min", sub: "Classical", ms: 1800000 },
] as const;

export type TimeControlId = (typeof TIME_CONTROLS)[number]["id"];

export function StatStrip({
  elo,
  wins,
  losses,
  helo,
}: {
  elo: number;
  wins: number;
  losses: number;
  helo: number;
}) {
  const total = wins + losses;
  const ratio = total > 0 ? Math.round((wins / total) * 100) : 0;
  const items = [
    { label: "ELO", value: String(elo), tone: "text-orange" },
    { label: "W / L", value: `${wins} / ${losses}`, tone: "text-teal" },
    { label: "Win rate", value: `${ratio}%`, tone: "text-teal" },
    { label: "$HELO", value: String(helo), tone: "text-orange" },
  ];

  return (
    <div className="surface grid grid-cols-2 gap-px overflow-hidden p-0 md:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="px-3 py-3 sm:px-4 sm:py-4">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{it.label}</p>
          <p className={`mt-0.5 sm:mt-1 truncate text-lg sm:text-xl font-extrabold ${it.tone}`}>{it.value}</p>
        </div>
      ))}
    </div>
  );
}

export function TimeControlSelector({
  value,
  onChange,
}: {
  value: TimeControlId;
  onChange: (id: TimeControlId) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
      {TIME_CONTROLS.map((tc) => {
        const active = tc.id === value;
        return (
          <button
            key={tc.id}
            onClick={() => onChange(tc.id)}
            className={`rounded-xl border px-2 sm:px-3 py-3 sm:py-4 text-center transition-all ${
              active
                ? "border-orange bg-orange-soft text-orange"
                : "border-line bg-[var(--surface-strong)] text-ink-muted hover:border-line-strong hover:text-ink"
            }`}
          >
            <span className="block text-base sm:text-lg font-extrabold">{tc.label}</span>
            <span className="block text-[10px] sm:text-[11px] font-medium uppercase tracking-wide opacity-70">{tc.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SearchingCard({
  queuePosition,
  timeControlLabel,
  onCancel,
}: {
  queuePosition: number;
  timeControlLabel: string;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = Math.floor(elapsed / 60);
  const ss = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div className="surface-modal mx-auto max-w-md p-6 sm:p-8 text-center">
      <div className="relative mx-auto mb-5 sm:mb-6 h-20 w-20 sm:h-24 sm:w-24">
        <div className="absolute inset-0 animate-ping rounded-full bg-orange-soft" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[var(--accent-orange)]" />
        <div className="absolute inset-3 grid place-items-center rounded-full bg-[var(--bg-base)]">
          <Search className="h-7 w-7 text-orange" />
        </div>
      </div>

      <h2 className="text-xl font-bold tracking-tight text-ink">Finding opponent</h2>
      <p className="mt-1 text-sm text-ink-muted">{timeControlLabel}</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="surface-inset p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Queue position</p>
          <p className="mt-1 text-2xl font-extrabold text-orange">
            {queuePosition > 0 ? `#${queuePosition}` : "—"}
          </p>
        </div>
        <div className="surface-inset p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Elapsed</p>
          <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-ink">
            {mm}:{ss}
          </p>
        </div>
      </div>

      <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-strong)]">
        <div className="h-full w-1/3 animate-[slide-in-right_1.4s_ease-in-out_infinite] bg-orange" />
      </div>

      <button
        onClick={onCancel}
        className="mt-6 w-full rounded-xl border border-[color-mix(in_oklab,var(--accent-danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--accent-danger)_14%,transparent)] px-6 py-3 font-bold text-danger-accent transition-colors hover:bg-[color-mix(in_oklab,var(--accent-danger)_22%,transparent)]"
      >
        Cancel search
      </button>
    </div>
  );
}
