import { useState, useEffect, memo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { X, Users, Eye } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';

interface SpectatorViewProps {
  gameId: string;
  whitePlayer: { name: string; elo: number };
  blackPlayer: { name: string; elo: number };
  onClose: () => void;
}

function SpectatorViewComponent({ gameId, whitePlayer, blackPlayer, onClose }: SpectatorViewProps) {
  const [fen, setFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [whiteTime, setWhiteTime] = useState<number>(600000);
  const [blackTime, setBlackTime] = useState<number>(600000);
  const [spectatorCount, setSpectatorCount] = useState<number>(0);
  const [moveHistory, setMoveHistory] = useState<any[]>([]);
  const [lastMove, setLastMove] = useState<{from: string, to: string} | null>(null);
  const [gameOver, setGameOver] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [currentTurn, setCurrentTurn] = useState<'w' | 'b'>('w');

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    console.log('[SPECTATE] Mounting - joining game:', gameId);
    
    // Join as spectator
    socket.emit('spectate_game', { gameId });
    
    const handleSpectateJoined = (data: any) => {
      console.log('[SPECTATE] Joined successfully:', data);
      setConnected(true);
      setWhiteTime(data.whiteTime || 600000);
      setBlackTime(data.blackTime || 600000);
      setSpectatorCount(data.spectatorCount || 0);
      
      if (data.fen) {
        setFen(data.fen);
        try {
          const chess = new Chess(data.fen);
          setCurrentTurn(chess.turn());
        } catch {
          // ignore
        }
      }
      if (Array.isArray(data.moveHistory)) {
        setMoveHistory(data.moveHistory);
      }
    };
    
    const handleBoardState = (data: any) => {
      setWhiteTime(data.whiteTime || 600000);
      setBlackTime(data.blackTime || 600000);
      
      if (data.lastMove) {
        setLastMove(data.lastMove);
      }
      
      if (data.fen) {
        setFen(data.fen);
        try {
          const chess = new Chess(data.fen);
          setCurrentTurn(chess.turn());
        } catch {
          // ignore
        }
      }
      if (Array.isArray(data.moveHistory)) {
        setMoveHistory(data.moveHistory);
      }
    };
    
    const handleSpectateError = ({ error }: { error: string }) => {
      console.error('[SPECTATE] Error:', error);
      toast.error(error);
      onClose();
    };
    
    const handleSpectatorCount = ({ count }: { count: number }) => {
      console.log('[SPECTATE] 👥 Spectator count:', count);
      setSpectatorCount(count);
    };
    
    const handleGameOver = ({ winner, reason }: { winner: string; reason: string }) => {
      console.log('[SPECTATE] 🏁 Game over:', winner, reason);
      let message = winner === 'draw' ? `Game drawn by ${reason}` : `${winner} won by ${reason}`;
      setGameOver(message);
    };
    
    socket.on('spectate_joined', handleSpectateJoined);
    socket.on('spectate_error', handleSpectateError);
    socket.on('board_state', handleBoardState);
    socket.on('spectator_count_updated', handleSpectatorCount);
    socket.on('game_over', handleGameOver);
    
    return () => {
      console.log('[SPECTATE] Unmounting - leaving game:', gameId);
      socket.emit('leave_spectate', { gameId });
      socket.off('spectate_joined', handleSpectateJoined);
      socket.off('spectate_error', handleSpectateError);
      socket.off('board_state', handleBoardState);
      socket.off('spectator_count_updated', handleSpectatorCount);
      socket.off('game_over', handleGameOver);
    };
  }, [gameId, onClose]);

  // Live timer countdown for spectators
  useEffect(() => {
    if (!connected || gameOver) return;
    
    const interval = setInterval(() => {
      if (currentTurn === 'w') {
        setWhiteTime(prev => Math.max(0, prev - 100));
      } else {
        setBlackTime(prev => Math.max(0, prev - 100));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [connected, currentTurn, gameOver]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Extract display moves from move history
  const displayMoves = moveHistory.map((m: any) => {
    if (typeof m === 'string') return m;
    if (m.san) return m.san;
    if (m.move && typeof m.move === 'string') return m.move;
    if (m.move && m.move.san) return m.move.san;
    // Try to reconstruct move notation
    if (m.from && m.to) return `${m.from}${m.to}`;
    if (m.move && m.move.from && m.move.to) return `${m.move.from}${m.move.to}`;
    return 'Unknown';
  });

  const squareStyles = lastMove ? {
    [lastMove.from]: { background: 'color-mix(in oklab, var(--accent-orange) 26%, transparent)' },
    [lastMove.to]: { background: 'color-mix(in oklab, var(--accent-orange) 34%, transparent)' },
  } : {};

  console.log('[SPECTATE] 🎨 Rendering board with FEN:', fen, '| Move count:', moveHistory.length);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-teal" />
            <h2 className="text-lg font-bold text-ink">Spectating Game</h2>
            {spectatorCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-teal/20 rounded text-xs font-semibold text-teal">
                <Users className="w-3.5 h-3.5" />
                <span>{spectatorCount} watching</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-ink-muted" />
          </button>
        </div>

        {!connected ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal mb-4"></div>
              <p className="text-ink-muted">Connecting to game...</p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {gameOver && (
              <div className="mb-4 p-4 bg-orange/20 border border-orange/30 rounded-lg text-center">
                <p className="text-orange font-semibold">{gameOver}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
              {/* Chessboard */}
              <div className="flex flex-col gap-4">
                {/* Black Player Card */}
                <div className={`surface p-4 rounded-lg flex items-center justify-between ${currentTurn === 'b' && !gameOver ? 'ring-2 ring-teal' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold">
                      ♟
                    </div>
                    <div>
                      <div className="font-semibold text-ink">{blackPlayer?.name || 'Black'}</div>
                      <div className="text-xs text-ink-muted">{blackPlayer?.elo || 1200} ELO</div>
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${currentTurn === 'b' && !gameOver ? 'text-teal' : 'text-ink-muted'}`}>
                    {formatTime(blackTime)}
                  </div>
                </div>

                <div className="rounded-lg overflow-hidden shadow-lg">
                  <Chessboard
                    key={`board-${moveHistory.length}-${fen.split(' ')[0]}`}
                    options={{
                      position: fen,
                      boardOrientation: "white",
                      darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
                      lightSquareStyle: { backgroundColor: 'var(--board-light)' },
                      showNotation: true,
                      squareStyles: squareStyles as never,
                    }}
                  />
                </div>

                {/* White Player Card */}
                <div className={`surface p-4 rounded-lg flex items-center justify-between ${currentTurn === 'w' && !gameOver ? 'ring-2 ring-teal' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-800 font-bold">
                      ♙
                    </div>
                    <div>
                      <div className="font-semibold text-ink">{whitePlayer?.name || 'White'}</div>
                      <div className="text-xs text-ink-muted">{whitePlayer?.elo || 1200} ELO</div>
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${currentTurn === 'w' && !gameOver ? 'text-teal' : 'text-ink-muted'}`}>
                    {formatTime(whiteTime)}
                  </div>
                </div>
              </div>

              {/* Move History */}
              <div className="surface p-4 rounded-lg max-h-[600px] overflow-y-auto">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-faint mb-3">
                  Move History ({moveHistory.length} moves)
                </h3>
                {displayMoves.length === 0 ? (
                  <p className="text-xs text-ink-faint text-center py-4">No moves yet</p>
                ) : (
                  <div className="space-y-1">
                    {displayMoves.map((move: string, index: number) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <span className="text-ink-faint font-mono w-8">{Math.floor(index / 2) + 1}.</span>
                        <span className="text-ink font-semibold">{move}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const SpectatorView = memo(SpectatorViewComponent);
