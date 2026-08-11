import { useState } from 'react';
import { X, BookOpen, Crown, Castle, Church, Swords, Shield } from 'lucide-react';

interface LearnChessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHESS_PIECES = [
  {
    name: 'King',
    icon: Crown,
    symbol: '♔',
    moves: 'Moves one square in any direction',
    value: 'Infinite (game ends if captured)',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/30',
  },
  {
    name: 'Queen',
    icon: Shield,
    symbol: '♕',
    moves: 'Moves any number of squares in any direction',
    value: '9 points',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/30',
  },
  {
    name: 'Rook',
    icon: Castle,
    symbol: '♖',
    moves: 'Moves horizontally or vertically any distance',
    value: '5 points',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/30',
  },
  {
    name: 'Bishop',
    icon: Church,
    symbol: '♗',
    moves: 'Moves diagonally any distance',
    value: '3 points',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400/30',
  },
  {
    name: 'Knight',
    icon: Swords,
    symbol: '♘',
    moves: 'Moves in an L-shape: 2 squares in one direction, 1 in perpendicular',
    value: '3 points',
    color: 'text-orange',
    bg: 'bg-orange/10',
    border: 'border-orange/30',
  },
  {
    name: 'Pawn',
    icon: Shield,
    symbol: '♙',
    moves: 'Moves forward 1 square (2 on first move), captures diagonally',
    value: '1 point',
    color: 'text-slate-400',
    bg: 'bg-slate-400/10',
    border: 'border-slate-400/30',
  },
];

const BASIC_RULES = [
  {
    title: 'Objective',
    description: 'Checkmate the opponent\'s King - trap it so it cannot escape capture',
  },
  {
    title: 'Check',
    description: 'When the King is under attack. You must move the King, block, or capture the attacker',
  },
  {
    title: 'Castling',
    description: 'Special move: King moves 2 squares toward a Rook, Rook jumps over. Only if neither piece has moved and path is clear',
  },
  {
    title: 'En Passant',
    description: 'Special pawn capture: If opponent pawn moves 2 squares past yours, you can capture it as if it moved 1 square',
  },
  {
    title: 'Promotion',
    description: 'When a pawn reaches the opposite end, it promotes to Queen, Rook, Bishop, or Knight',
  },
];

export function LearnChessModal({ isOpen, onClose }: LearnChessModalProps) {
  const [currentTab, setCurrentTab] = useState<'pieces' | 'rules'>('pieces');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto surface p-0 animate-in zoom-in-95 duration-300 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-orange/20 via-teal/10 to-blue/20 border-b border-line p-5">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line text-ink-muted hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-orange/20 border border-orange/30">
              <BookOpen className="w-5 h-5 text-orange" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">Learn Chess Basics</h2>
              <p className="text-xs text-ink-muted">Master the pieces and rules</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentTab('pieces')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                currentTab === 'pieces'
                  ? 'bg-orange text-canvas shadow-lg'
                  : 'bg-[var(--surface-strong)] text-ink-muted hover:text-ink hover:bg-[var(--surface-hover)]'
              }`}
            >
              Chess Pieces
            </button>
            <button
              onClick={() => setCurrentTab('rules')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                currentTab === 'rules'
                  ? 'bg-orange text-canvas shadow-lg'
                  : 'bg-[var(--surface-strong)] text-ink-muted hover:text-ink hover:bg-[var(--surface-hover)]'
              }`}
            >
              Basic Rules
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {currentTab === 'pieces' && (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted mb-4">
                Each chess piece moves differently. Learn their unique abilities:
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {CHESS_PIECES.map((piece) => {
                  const Icon = piece.icon;
                  return (
                    <div
                      key={piece.name}
                      className={`rounded-xl border ${piece.border} ${piece.bg} p-4 hover:scale-[1.02] transition-transform`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${piece.bg} border ${piece.border} flex items-center justify-center`}>
                          <span className="text-2xl">{piece.symbol}</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`text-base font-bold ${piece.color}`}>
                              {piece.name}
                            </h3>
                            <span className="text-xs text-ink-faint">
                              {piece.value}
                            </span>
                          </div>
                          <p className="text-xs text-ink-muted leading-relaxed">
                            {piece.moves}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tip */}
              <div className="mt-6 p-4 rounded-lg bg-teal/10 border border-teal/30">
                <p className="text-xs text-teal font-semibold mb-1">💡 Pro Tip</p>
                <p className="text-xs text-ink-muted">
                  Protect your King, control the center, and develop your pieces early. Knights before Bishops!
                </p>
              </div>
            </div>
          )}

          {currentTab === 'rules' && (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted mb-4">
                Essential rules every chess player should know:
              </p>

              <div className="space-y-3">
                {BASIC_RULES.map((rule, index) => (
                  <div
                    key={rule.title}
                    className="p-4 rounded-xl bg-[var(--surface-strong)] border border-line hover:border-line-strong transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange/20 border border-orange/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-orange">{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-ink mb-1">
                          {rule.title}
                        </h3>
                        <p className="text-xs text-ink-muted leading-relaxed">
                          {rule.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Additional Info */}
              <div className="mt-6 grid sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-lg bg-blue/10 border border-blue/30">
                  <p className="text-xs text-blue font-semibold mb-1">⏱️ Time Controls</p>
                  <p className="text-xs text-ink-muted">
                    Each player has a clock. In HemiChess, make your moves before time runs out!
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-amber-400/10 border border-amber-400/30">
                  <p className="text-xs text-amber-400 font-semibold mb-1">🏆 Practice Makes Perfect</p>
                  <p className="text-xs text-ink-muted">
                    Start with unranked games to practice without affecting your ELO rating.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line bg-[var(--surface-strong)] p-5 text-center">
          <p className="text-xs text-ink-faint mb-3">
            Want to learn more? Check out <a href="https://www.chess.com/learn-how-to-play-chess" target="_blank" rel="noopener noreferrer" className="text-orange hover:underline">Chess.com's tutorials</a>
          </p>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-orange hover:bg-orange/90 text-canvas rounded-lg font-semibold text-sm transition-all"
          >
            Got it, let's play! 🎯
          </button>
        </div>
      </div>
    </div>
  );
}
