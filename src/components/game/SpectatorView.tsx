import { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { X, Users, Eye } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { PlayerCard } from '@/components/game/GamePanels';

interface SpectatorViewProps {
  gameId: string;
  whitePlayer: { name: string; elo: number };
  blackPlayer: { name: string; elo: number };
  onClose: () => void;
}

export function SpectatorView({ gameId, whitePlayer, blackPlayer, onClose }: SpectatorViewProps) {
  const [game, setGame] = useState<Chess>(new Chess());
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
    
    // Join as spectator
    console.log('[SPECTATE] Joining game:', gameId);
    socket.emit('spectate_game', { gameId });
    
    // Listen for spectate events
    socket.on('spectate_joined', (data) => {
      console.log('[SPECTATE] Joined successfully:', data);
      setConnected(true);
      
      const newGame = new Chess(data.fen);
      setGame(newGame);
      setFen(data.fen);
      setCurrentTurn(newGame.turn());
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setMoveHistory(data.moveHistory || []);
      setLastMove(data.lastMove);
      setSpectatorCount(data.spectatorCount);
    });
    
    socket.on('spectate_error', ({ error }) => {
      console.error('[SPECTATE] Error:', error);
      alert(error);
      onClose();
    });
    
    socket.on('board_state', ({ fen: newFen, lastMove: moveData, whiteTime: wTime, blackTime: bTime, moveHistory: history }) => {
      console.log('[SPECTATE] Board update received:', {
        newFen,
        currentFen: fen,
        moveData,
        historyLength: history?.length
      });
      
      // Force update by creating new Chess instance and setting FEN
      const newGame = new Chess(newFen);
      setGame(newGame);
      setFen(newFen);
      setCurrentTurn(newGame.turn());
      setLastMove(moveData || null);
      setWhiteTime(wTime);
      setBlackTime(bTime);
      setMoveHistory(history || []);
    });
    
    socket.on('spectator_count_updated', ({ count }) => {
      setSpectatorCount(count);
    });
    
    socket.on('game_over', ({ winner, reason }) => {
      let message = '';
      if (winner === 'draw') {
        message = `Game drawn by ${reason}`;
      } else {
        message = `${winner} won by ${reason}`;
      }
      setGameOver(message);
    });
    
    return () => {
      console.log('[SPECTATE] Leaving game:', gameId);
      socket.emit('leave_spectate', { gameId });
      socket.off('spectate_joined');
      socket.off('spectate_error');
      socket.off('board_state');
      socket.off('spectator_count_updated');
      socket.off('game_over');
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

  const squareStyles = lastMove ? {
    [lastMove.from]: { background: 'color-mix(in oklab, var(--accent-orange) 26%, transparent)' },
    [lastMove.to]: { background: 'color-mix(in oklab, var(--accent-orange) 34%, transparent)' },
  } : {};

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
                <PlayerCard
                  color="black"
                  playerName={blackPlayer.name}
                  elo={blackPlayer.elo}
                  timeLeft={blackTime}
                  formatTime={formatTime}
                  isMyTurn={false}
                  avatarUrl={null}
                />

                <div className="rounded-lg overflow-hidden shadow-lg">
                  <Chessboard
                    key={fen} // Force re-render on FEN change
                    position={fen}
                    boardOrientation="white"
                    arePiecesDraggable={false}
                    customSquareStyles={squareStyles}
                  />
                </div>

                {/* White Player Card */}
                <PlayerCard
                  color="white"
                  playerName={whitePlayer.name}
                  elo={whitePlayer.elo}
                  timeLeft={whiteTime}
                  formatTime={formatTime}
                  isMyTurn={false}
                  avatarUrl={null}
                />
              </div>

              {/* Move History */}
              <div className="surface p-4 rounded-lg max-h-[600px] overflow-y-auto">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-faint mb-3">
                  Move History
                </h3>
                {moveHistory.length === 0 ? (
                  <p className="text-xs text-ink-faint text-center py-4">No moves yet</p>
                ) : (
                  <div className="space-y-1">
                    {moveHistory.map((move, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <span className="text-ink-faint font-mono w-8">{Math.floor(index / 2) + 1}.</span>
                        <span className="text-ink font-semibold">{move.move}</span>
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
