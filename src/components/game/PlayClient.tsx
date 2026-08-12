import { getSocket } from '@/lib/socket';
import { SettlementToast } from '@/components/SettlementToast';
import { LearnChessModal } from '@/components/LearnChessModal';
import { OnlineUsers } from '@/components/game/OnlineUsers';
import { LiveGames } from '@/components/game/LiveGames';
import { SpectatorView } from '@/components/game/SpectatorView';
import { getBackendUrl } from '@/lib/config';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useAccount } from 'wagmi';
import { Navbar } from '@/components/Navbar';
import { PlayerCard, GamePanel } from '@/components/game/GamePanels';
import {
  SearchingCard,
  StatStrip,
  TimeControlSelector,
  TIME_CONTROLS,
  type TimeControlId,
} from '@/components/game/Lobby';
import { useUserStats, useMatchHistory, DEFAULT_ELO } from '@/hooks/useUserStats';
import { usePlayerStats } from '@/hooks/useHemiChessElo';
import { AlertTriangle, Crown, Scale, Flag, Handshake, List, BookOpen } from 'lucide-react';
import { toast } from 'sonner';


type GameState = 'menu' | 'finding' | 'playing' | 'finished';

export function PlayClient() {
  // Get shared socket instance
  const [socket, setSocket] = useState<Socket | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const socketInstance = getSocket();
      setSocket(socketInstance);
    }
  }, []);
  // Web3 wallet connection
  const { address, isConnected } = useAccount();
  
  // Game state
  const [gameState, setGameState] = useState<GameState>('menu');
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerDisplayName, setPlayerDisplayName] = useState<string>('');
  
  // Use wallet address as player ID when connected
  const playerId = isConnected && address ? address.toLowerCase() : 
    (typeof window !== 'undefined' ? localStorage.getItem('hemichess_player_id') || `player_${Date.now()}` : `player_${Date.now()}`);
  
  // Chess game state
  const [game, setGame] = useState<Chess>(new Chess());
  const [fen, setFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [orientation, setOrientation] = useState<"white" | "black" | null>(null);
  const [myTurn, setMyTurn] = useState<boolean>(false);
  const [opponentName, setOpponentName] = useState<string>('Opponent');
  const [opponentElo, setOpponentElo] = useState<number>(200);
  const [opponentAvatar, setOpponentAvatar] = useState<string | null>(null);
  const [myGameElo, setMyGameElo] = useState<number>(200);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  
  // Game status
  const [status, setStatus] = useState<string>("Welcome to HemiChess");
  const [gameOverMsg, setGameOverMsg] = useState<string>("");
  const [queuePosition, setQueuePosition] = useState<number>(0);
  const [disconnectWarning, setDisconnectWarning] = useState<string>("");
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState<boolean>(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState<number>(60);
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Spectator mode
  const [spectatingGameId, setSpectatingGameId] = useState<string | null>(null);
  const [spectatingPlayers, setSpectatingPlayers] = useState<{ white: any; black: any } | null>(null);
  
  // Time controls
  const [myTime, setMyTime] = useState<number>(600000); // 10 minutes
  const [opponentTime, setOpponentTime] = useState<number>(600000);
  
  // Draw/Resign
  const [drawOffered, setDrawOffered] = useState<boolean>(false);
  const [opponentOfferedDraw, setOpponentOfferedDraw] = useState<boolean>(false);
  
  // Learn Chess Modal
  const [showLearnModal, setShowLearnModal] = useState<boolean>(false);
  
  // Last move highlight
  const [lastMove, setLastMove] = useState<{from: string, to: string} | null>(null);
  
  // Move history
  const [moveHistory, setMoveHistory] = useState<any[]>([]);
  const [eloChange, setEloChange] = useState<number | null>(null);

  // Get live user stats from database (source of truth)
  const { data: dbStats, isLoading: isLoadingStats } = useUserStats();
  const { data: matchHistory, isLoading: isLoadingHistory } = useMatchHistory(4);

  // Database ELO is the SOURCE OF TRUTH for display, matchmaking and settlement
  const userStats = {
    elo: dbStats?.elo_rating ?? DEFAULT_ELO,
    wins: dbStats?.wins || 0,
    losses: dbStats?.losses || 0,
    draws: dbStats?.draws || 0,
    totalGames: dbStats?.total_games || 0,
    winRate: dbStats?.win_rate || 0,
  };

  // Get display name from database or use wallet address
  const getDisplayName = useCallback(() => {
    if (!isConnected || !address) return '';
    
    // Use username from database (dbStats) if available
    if (dbStats?.username) {
      return dbStats.username;
    }
    
    // Fallback to truncated wallet address
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [isConnected, address, dbStats]);


  // Selected time control (lobby)
  const [timeControlId, setTimeControlId] = useState<TimeControlId>('rapid10');
  const timeControl = TIME_CONTROLS.find((t) => t.id === timeControlId) ?? TIME_CONTROLS[2];

  // Check for pending game from challenge acceptance (after navigation)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const pendingGameData = sessionStorage.getItem('pendingGame');
    if (pendingGameData) {
      try {
        const gameData = JSON.parse(pendingGameData);
        console.log('[PENDING_GAME] Found pending game in sessionStorage:', gameData);
        
        // Clear it immediately to prevent re-processing
        sessionStorage.removeItem('pendingGame');
        
        // Manually set up the game state (same as MATCH_STARTING handler)
        setGameId(gameData.gameId);
        setOrientation(gameData.color);
        setOpponentName(gameData.opponent?.name || 'Opponent');
        setOpponentElo(gameData.opponent?.elo || gameData.opponentElo || DEFAULT_ELO);
        setOpponentAvatar(gameData.opponent?.avatar || null);
        setMyGameElo(gameData.myElo || DEFAULT_ELO);
        setMyAvatar(gameData.myAvatar || null);
        setMyTurn(gameData.color === 'white');
        setMyTime(gameData.timeLeft);
        setOpponentTime(gameData.opponentTimeLeft);
        setGameState('playing');
        
        const statusText = gameData.isFriendMatch 
          ? `Friend Match - Playing as ${gameData.color} (UNRANKED)`
          : `Playing as ${gameData.color}`;
        setStatus(statusText);
        
        const newGame = new Chess(gameData.fen);
        setGame(newGame);
        setFen(gameData.fen);
        
        console.log('[PENDING_GAME] Game setup complete, will join room when socket ready');
      } catch (err) {
        console.error('[PENDING_GAME] Error processing pending game:', err);
        sessionStorage.removeItem('pendingGame');
      }
    }
  }, []); // Run only once on mount - socket connection handled separately

  // Separate effect to join game room when socket becomes ready
  useEffect(() => {
    if (!socket?.connected || !isConnected || !address || !gameId) return;
    
    // If we have a gameId and just connected, join the room
    if (gameState === 'playing') {
      console.log('[SOCKET_READY] Joining game room:', gameId, 'with wallet:', address);
      socket.emit('join_game_room', { 
        gameId,
        walletAddress: address.toLowerCase()
      });
    }
  }, [socket?.connected, isConnected, address, gameId, gameState]); // Join when socket/wallet/game becomes ready

  useEffect(() => {
    if (!socket) return;
    
    console.log('[PLAY] Setting up game event listeners');

    socket.on('connect', () => {
      console.log('[PLAY] Game client connected to server');
      setStatus('Connected to server');
      
      // If we have an active game, rejoin the room
      if (gameId && gameState === 'playing' && isConnected && address) {
        console.log('[RECONNECT] Rejoining game room:', gameId, 'with wallet:', address);
        socket.emit('join_game_room', { 
          gameId,
          walletAddress: address.toLowerCase()
        });
      }
      
      // Check for active session if wallet is connected
      if (isConnected && address) {
        console.log('[SESSION] Checking for active game session...');
        setReconnecting(true);
        socket?.emit('check_active_session', { 
          walletAddress: address.toLowerCase()
        });
        
        // Timeout check - if no game restored in 2 seconds, stop reconnecting state
        setTimeout(() => setReconnecting(false), 2000);
      }
    });

    socket.on('disconnect', () => {
      setStatus('Disconnected from server');
    });

    // Matchmaking events
    socket.on('queue_joined', ({ position }) => {
      setQueuePosition(position);
      setStatus(`Finding opponent... Position in queue: ${position}`);
    });

    socket.on('matchmaking_cancelled', () => {
      setGameState('menu');
      setStatus('Matchmaking cancelled');
    });

    socket.on('matchmaking_rejected', ({ error, requiresClaim }) => {
      setGameState('menu');
      setStatus(error || 'Unable to join matchmaking');
      console.log('[GATEKEEPER] Matchmaking rejected:', error);
    });

    socket.on('game_restored', ({ gameId: foundGameId, fen: initialFen, color, whiteTimeLeft, blackTimeLeft, moveHistory: history, opponentName: oppName, opponentElo: oppElo, opponentAvatar: oppAvatar, myElo, myAvatar: myAv, drawOffer: restoredDrawOffer }) => {
      console.log('[RESTORE] Game session restored!', { gameId: foundGameId, color, opponentElo: oppElo, myElo });
      setReconnecting(false);
      setGameId(foundGameId);
      setOrientation(color);
      setOpponentName(oppName || 'Opponent');
      setOpponentElo(oppElo || 200);
      setOpponentAvatar(oppAvatar || null);
      setMyGameElo(myElo || DEFAULT_ELO);
      setMyAvatar(myAv || null);
      setMyTime(color === 'white' ? whiteTimeLeft : blackTimeLeft);
      setOpponentTime(color === 'white' ? blackTimeLeft : whiteTimeLeft);
      setMoveHistory(history || []);
      
      // Restore draw offer state
      if (restoredDrawOffer) {
        if (restoredDrawOffer === color) {
          setDrawOffered(true);
        } else {
          setOpponentOfferedDraw(true);
        }
      }
      
      const newGame = new Chess(initialFen);
      setGame(newGame);
      setFen(initialFen);
      
      const currentTurn = newGame.turn();
      const playerColorShort = color === 'white' ? 'w' : 'b';
      setMyTurn(currentTurn === playerColorShort);
      
      setGameState('playing');
      setStatus(`Reconnected! Playing as ${color}`);
      setDisconnectWarning('');
      setOpponentDisconnected(false);
    });

    socket.on('game_found', ({ gameId: foundGameId, color, opponent, fen: initialFen, timeLeft, opponentTimeLeft, myElo, myAvatar: myAv, opponentElo: oppElo, isRanked, isFriendMatch }) => {
      console.log('Game found!', { gameId: foundGameId, color, myElo, opponentElo: oppElo, isRanked, isFriendMatch });
      setGameId(foundGameId);
      setOrientation(color);
      setOpponentName(opponent.name || 'Opponent');
      setOpponentElo(opponent.elo || oppElo || DEFAULT_ELO);
      setOpponentAvatar(opponent.avatar || null);
      setMyGameElo(myElo || DEFAULT_ELO);
      setMyAvatar(myAv || null);
      setMyTurn(color === 'white');
      setMyTime(timeLeft);
      setOpponentTime(opponentTimeLeft);
      setGameState('playing');
      
      // Set status based on match type
      if (isFriendMatch) {
        setStatus(`Friend Match - Playing as ${color} (UNRANKED)`);
      } else {
        setStatus(`Playing as ${color}`);
      }
      
      const newGame = new Chess(initialFen);
      setGame(newGame);
      setFen(initialFen);
      
      // Join the game room immediately
      if (address) {
        console.log('[GAME_FOUND] Joining game room immediately:', foundGameId);
        socket.emit('join_game_room', { 
          gameId: foundGameId,
          walletAddress: address.toLowerCase()
        });
      }
    });

    // Match starting from challenge acceptance
    socket.on('MATCH_STARTING', ({ gameId: foundGameId, color, opponent, fen: initialFen, timeLeft, opponentTimeLeft, myElo, myAvatar: myAv, opponentElo: oppElo, isRanked, isFriendMatch }) => {
      console.log('[MATCH_STARTING] Friend match starting!', { gameId: foundGameId, color, isFriendMatch });
      
      // Check if we're already on the play page
      const isOnPlayPage = typeof window !== 'undefined' && window.location.pathname === '/play';
      
      if (!isOnPlayPage) {
        // Store game data and navigate to play page
        console.log('[MATCH_STARTING] Not on play page, storing game data and navigating...');
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('pendingGame', JSON.stringify({
            gameId: foundGameId,
            color,
            opponent,
            fen: initialFen,
            timeLeft,
            opponentTimeLeft,
            myElo,
            myAvatar: myAv,
            opponentElo: oppElo,
            isRanked,
            isFriendMatch
          }));
          window.location.href = '/play';
        }
        return;
      }
      
      // We're already on the play page - set up game immediately
      console.log('[MATCH_STARTING] On play page, setting up game immediately');
      setGameId(foundGameId);
      setOrientation(color);
      setOpponentName(opponent.name || 'Opponent');
      setOpponentElo(opponent.elo || oppElo || DEFAULT_ELO);
      setOpponentAvatar(opponent.avatar || null);
      setMyGameElo(myElo || DEFAULT_ELO);
      setMyAvatar(myAv || null);
      setMyTurn(color === 'white');
      setMyTime(timeLeft);
      setOpponentTime(opponentTimeLeft);
      setGameState('playing');
      setStatus(`Friend Match - Playing as ${color} (UNRANKED)`);
      
      const newGame = new Chess(initialFen);
      setGame(newGame);
      setFen(initialFen);
      
      // Join the game room immediately
      if (address) {
        console.log('[MATCH_STARTING] Joining game room immediately:', foundGameId);
        socket.emit('join_game_room', { 
          gameId: foundGameId,
          walletAddress: address.toLowerCase()
        });
      }
    });

    // Game events
    socket.on('board_state', ({ fen: newFen, lastMove: moveData, whiteTime, blackTime, moveHistory: history }) => {
      const newGame = new Chess(newFen);
      setGame(newGame);
      setFen(newFen);
      setLastMove(moveData || null);
      setMoveHistory(history || []);
      
      if (orientation) {
        const currentTurn = newGame.turn();
        const playerColorShort = orientation === 'white' ? 'w' : 'b';
        setMyTurn(currentTurn === playerColorShort);
        
        if (orientation === 'white') {
          setMyTime(whiteTime);
          setOpponentTime(blackTime);
        } else {
          setMyTime(blackTime);
          setOpponentTime(whiteTime);
        }
      }
    });

    socket.on('game_over', ({ winner, reason, finalFen }) => {
      console.log('[GAME_OVER] Received:', { winner, reason, myOrientation: orientation });
      setGameState('finished');
      let message = '';
      if (winner === 'draw') {
        message = `Game drawn by ${reason}`;
      } else if (winner === orientation) {
        message = `You won by ${reason}!`;
      } else {
        message = `You lost by ${reason}`;
      }
      console.log('[GAME_OVER] Message:', message, '| Comparison:', { winner, orientation, match: winner === orientation });
      setGameOverMsg(message);
      setStatus('Game Over');
      
      // Clear any disconnect warnings
      setOpponentDisconnected(false);
      setDisconnectWarning('');
      if (countdownInterval) {
        clearInterval(countdownInterval);
        setCountdownInterval(null);
      }
    });

    socket.on('invalid_move', ({ error }) => {
      console.log('Invalid move:', error);
    });

    socket.on('draw_offered', ({ from }) => {
      console.log('[DRAW] Opponent offered draw');
      setOpponentOfferedDraw(true);
      setStatus(`${from} offered a draw - Accept or Decline below`);
    });

    socket.on('draw_offer_cancelled', ({ by }) => {
      console.log('[DRAW] Opponent cancelled draw offer');
      setOpponentOfferedDraw(false);
      setStatus(`${by} cancelled their draw offer`);
      setTimeout(() => setStatus(`Playing as ${orientation}`), 3000);
    });

    socket.on('draw_declined', () => {
      console.log('[DRAW] Opponent declined draw offer');
      setDrawOffered(false);
      setStatus('Your draw offer was declined');
      setTimeout(() => setStatus(`Playing as ${orientation}`), 3000);
    });

    socket.on('opponent_disconnected', ({ color, graceSeconds }) => {
      const seconds = graceSeconds || 60;
      setOpponentDisconnected(true);
      setDisconnectCountdown(seconds);
      setDisconnectWarning(`Opponent (${color}) disconnected. You win in ${seconds}s if they don't return...`);
      setStatus(`Opponent disconnected - ${seconds}s grace period`);
      
      // Clear any existing interval
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      
      // Start countdown
      let remaining = seconds;
      const countdown = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          setDisconnectCountdown(remaining);
          setDisconnectWarning(`Opponent (${color}) disconnected. You win in ${remaining}s if they don't return...`);
        } else {
          clearInterval(countdown);
        }
      }, 1000);
      
      setCountdownInterval(countdown);
    });

    socket.on('opponent_reconnected', ({ color }) => {
      // Immediately clear disconnect state
      setOpponentDisconnected(false);
      setDisconnectWarning('');
      setDisconnectCountdown(60);
      
      // Clear countdown interval
      if (countdownInterval) {
        clearInterval(countdownInterval);
        setCountdownInterval(null);
      }
      
      setStatus(`Opponent (${color}) reconnected! Game continues.`);
      setTimeout(() => setStatus(`Playing as ${orientation}`), 3000);
    });

    socket.on('error', ({ message }) => {
      console.error('Server error:', message);
      setStatus(`Error: ${message}`);
    });

    socket.on('settlement_complete', ({ whiteResult, blackResult }) => {
      if (!address) return;
      let myResult;
      if (orientation === 'white') {
        myResult = whiteResult;
      } else if (orientation === 'black') {
        myResult = blackResult;
      }

      if (myResult && typeof myResult.change === 'number') {
        setEloChange(myResult.change);
      }
    });

    return () => {
      // Don't disconnect - socket is shared globally
      console.log('[PLAY] Cleaning up game event listeners');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('queue_joined');
      socket.off('matchmaking_cancelled');
      socket.off('matchmaking_rejected');
      socket.off('game_restored');
      socket.off('game_found');
      socket.off('MATCH_STARTING');
      socket.off('board_state');
      socket.off('game_over');
      socket.off('invalid_move');
      socket.off('draw_offered');
      socket.off('draw_offer_cancelled');
      socket.off('draw_declined');
      socket.off('opponent_disconnected');
      socket.off('opponent_reconnected');
      socket.off('error');
      socket.off('settlement_complete');
    };
  }, [isConnected, address, getDisplayName, socket, orientation, countdownInterval]);

  // Timer countdown
  useEffect(() => {
    if (gameState === 'playing' && !gameOverMsg) {
      const interval = setInterval(() => {
        if (myTurn) {
          setMyTime(prev => Math.max(0, prev - 100));
        } else {
          setOpponentTime(prev => Math.max(0, prev - 100));
        }
      }, 100);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [gameState, myTurn, gameOverMsg]);

  // Format time display
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Load display name when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      const displayName = getDisplayName();
      setPlayerDisplayName(displayName);
    }
  }, [isConnected, address, getDisplayName]);

  // Find match
  const handleFindMatch = () => {
    // Require wallet connection for Web3 mode
    if (!isConnected || !address) {
      setStatus('Please connect your wallet to play');
      return;
    }

    if (!socket) {
      console.error('[MATCH] Socket not initialized!');
      setStatus('Connecting to server...');
      return;
    }

    const displayName = getDisplayName();
    console.log('[MATCH] Requesting match:', { 
      playerId: address.toLowerCase(),
      playerName: displayName,
      socketConnected: socket.connected
    });
    
    setGameState('finding');
    setStatus('Finding opponent...');
    
    socket.emit('find_match', { 
      playerId: address.toLowerCase(),
      walletAddress: address.toLowerCase(),
      playerName: displayName,
      timeControl: timeControl?.ms ?? 600000
    });

  };

  // Cancel matchmaking
  const handleCancelMatchmaking = () => {
    if (!socket) return;
    socket.emit('cancel_matchmaking');
    setGameState('menu');
  };

  // Make a move
  const handleMove = useCallback((sourceSquare: string, targetSquare: string, piece: string) => {
    if (!gameId || !orientation || gameState !== 'playing') {
      return false;
    }

    const gameCopy = new Chess(fen);
    const currentTurn = gameCopy.turn();
    const playerColorShort = orientation === 'white' ? 'w' : 'b';
    
    const pieceColor = piece.charAt(0);
    
    if (pieceColor !== playerColorShort) {
      console.log('Cannot move opponent\'s piece');
      return false;
    }
    
    if (currentTurn !== playerColorShort) {
      console.log('Not your turn');
      return false;
    }
    
    try {
      const moveResult = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (moveResult) {
        // Optimistic update
        setFen(gameCopy.fen());
        setGame(gameCopy);

        if (socket) {
          socket.emit('make_move', {
            gameId,
            move: {
              from: sourceSquare,
              to: targetSquare,
              promotion: 'q',
            }
          });
        }
        return true;
      }
    } catch (e) {
      console.log('Invalid move:', e);
      return false;
    }
    
    return false;
  }, [gameId, orientation, fen, gameState]);

  // Offer draw
  const handleOfferDraw = () => {
    if (gameId && socket) {
      socket.emit('offer_draw', { gameId });
      setDrawOffered(true);
      setStatus('Draw offer sent - waiting for opponent...');
    }
  };

  // Accept draw
  const handleAcceptDraw = () => {
    if (gameId && socket) {
      socket.emit('accept_draw', { gameId });
      setOpponentOfferedDraw(false);
      setStatus('Draw accepted - ending game...');
    }
  };

  // Decline draw
  const handleDeclineDraw = () => {
    if (gameId && socket) {
      socket.emit('decline_draw', { gameId });
      setOpponentOfferedDraw(false);
      setStatus('Draw offer declined');
      setTimeout(() => setStatus(`Playing as ${orientation}`), 2000);
    }
  };

  // Resign
  const handleResign = () => {
    if (gameId && socket && confirm('Are you sure you want to resign?')) {
      socket.emit('resign', { gameId });
    }
  };

  // Play again
  const handlePlayAgain = () => {
    setGameState('menu');
    setGameId(null);
    setOrientation(null);
    setFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setGame(new Chess());
    setGameOverMsg('');
    setMyTime(timeControl?.ms ?? 600000);
    setOpponentTime(timeControl?.ms ?? 600000);
    setMoveHistory([]);
    setLastMove(null);
    setDrawOffered(false);
    setOpponentOfferedDraw(false);
    setSelectedSquare(null);
    setEloChange(null);
  };

  // ── Board tactical feedback ─────────────────────────────
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const legalTargets = useMemo(() => {
    if (!selectedSquare) return [] as { to: string; captured: boolean }[];
    try {
      const moves = new Chess(fen).moves({ square: selectedSquare as never, verbose: true }) as any[];
      return moves.map((m) => ({ to: m.to as string, captured: Boolean(m.captured) }));
    } catch {
      return [];
    }
  }, [fen, selectedSquare]);

  const checkSquare = useMemo(() => {
    try {
      const c = new Chess(fen);
      if (!c.inCheck()) return null;
      const turn = c.turn();
      for (const row of c.board()) {
        for (const sq of row) {
          if (sq && sq.type === 'k' && sq.color === turn) return sq.square as string;
        }
      }
    } catch {
      return null;
    }
    return null;
  }, [fen]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, Record<string, string>> = {};
    if (lastMove) {
      styles[lastMove.from] = { background: 'color-mix(in oklab, var(--accent-orange) 26%, transparent)' };
      styles[lastMove.to] = { background: 'color-mix(in oklab, var(--accent-orange) 34%, transparent)' };
    }
    if (checkSquare) {
      styles[checkSquare] = {
        background: 'radial-gradient(circle, color-mix(in oklab, var(--accent-danger) 75%, transparent) 12%, transparent 72%)',
      };
    }
    if (selectedSquare) {
      styles[selectedSquare] = {
        ...(styles[selectedSquare] ?? {}),
        boxShadow: 'inset 0 0 0 3px var(--accent-orange)',
      };
    }
    for (const t of legalTargets) {
      styles[t.to] = {
        ...(styles[t.to] ?? {}),
        background: t.captured
          ? 'radial-gradient(circle, transparent 54%, color-mix(in oklab, var(--accent-danger) 60%, transparent) 56%)'
          : 'radial-gradient(circle, color-mix(in oklab, var(--accent-orange) 65%, transparent) 20%, transparent 22%)',
      };
    }
    return styles;
  }, [lastMove, checkSquare, selectedSquare, legalTargets]);

  const handleSquareClick = useCallback(
    (square: string) => {
      if (selectedSquare && selectedSquare !== square) {
        const target = legalTargets.find((t) => t.to === square);
        if (target) {
          try {
            const piece = new Chess(fen).get(selectedSquare as never);
            if (piece) handleMove(selectedSquare, square, `${piece.color}${piece.type.toUpperCase()}`);
          } catch {
            /* ignore */
          }
          setSelectedSquare(null);
          return;
        }
      }
      setSelectedSquare((prev) => (prev === square ? null : square));
    },
    [selectedSquare, legalTargets, fen, handleMove],
  );

  const walletBadge = address ?? undefined;
  const opponentColor: 'white' | 'black' = orientation === 'white' ? 'black' : 'white';

  // Challenge handler
  const handleChallenge = async (opponentId: string, opponentName: string) => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet to send challenges');
      return;
    }

    try {
      const response = await fetch(`${getBackendUrl()}/api/challenge/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengerId: address.toLowerCase(),
          opponentId: opponentId.toLowerCase(),
          timeControl: timeControl?.ms ?? 600000,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Challenge sent to ${opponentName}`, {
          description: 'Waiting for opponent to accept...',
        });
      } else {
        toast.error('Failed to send challenge', {
          description: data.error || 'Please try again',
        });
      }
    } catch (err) {
      console.error('[Challenge] Error:', err);
      toast.error('Connection error', {
        description: 'Unable to send challenge',
      });
    }
  };

  // Spectate handler
  const handleSpectate = (gameId: string, whitePlayer: any, blackPlayer: any) => {
    setSpectatingGameId(gameId);
    setSpectatingPlayers({ white: whitePlayer, black: blackPlayer });
  };

  const handleCloseSpectate = () => {
    setSpectatingGameId(null);
    setSpectatingPlayers(null);
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Spectator Modal */}
      {spectatingGameId && spectatingPlayers && (
        <SpectatorView
          gameId={spectatingGameId}
          whitePlayer={spectatingPlayers.white}
          blackPlayer={spectatingPlayers.black}
          onClose={handleCloseSpectate}
        />
      )}
      <Navbar />
      <SettlementToast />

      <main className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        {/* ── Lobby ───────────────────────────────────────── */}
        {gameState === 'menu' && (
          <div className="space-y-4 sm:space-y-6">
            <header className="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
                  Play
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-ink-muted">Ranked chess on Hemi Testnet</p>
              </div>
            </header>

            {isConnected && address && (
              <StatStrip
                elo={userStats.elo}
                wins={userStats.wins}
                losses={userStats.losses}
                helo={userStats.elo}
              />
            )}

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.15fr_1fr]">
              <section className="surface p-4 sm:p-6 md:p-8">
                {isConnected && address ? (
                  <>
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-faint">Time control</h2>
                    <TimeControlSelector value={timeControlId} onChange={setTimeControlId} />

                    {isLoadingStats ? (
                      <div className="mt-8">
                        <button
                          disabled
                          className="w-full cursor-not-allowed rounded-xl bg-slate-700 px-8 py-4 font-extrabold text-slate-400 opacity-60"
                        >
                          Loading your rating…
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={handleFindMatch}
                          className="mt-8 w-full rounded-xl bg-orange px-8 py-4 text-canvas font-extrabold shadow-[0_0_28px_-8px_var(--accent-orange)] transition-transform hover:-translate-y-0.5"
                        >
                          Find match
                        </button>
                        <p className="mt-3 text-center text-xs text-ink-faint">
                          {timeControl?.label} {timeControl?.sub} • {userStats.elo} ELO rated
                        </p>
                        
                        {/* Learn Chess Button */}
                        <button
                          onClick={() => setShowLearnModal(true)}
                          className="mt-4 w-full rounded-lg border border-line bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-semibold text-ink-muted hover:text-ink hover:bg-[var(--surface-hover)] transition-all flex items-center justify-center gap-2"
                        >
                          <BookOpen className="w-4 h-4" />
                          Learn Chess Basics
                        </button>
                      </>
                    )}

                  </>
                ) : (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[var(--surface-strong)] ring-1 ring-line">
                      <Crown className="h-7 w-7 text-ink-faint" />
                    </div>
                    <h3 className="text-xl font-bold text-ink">Connect wallet to play</h3>
                    <p className="mt-2 text-sm text-ink-muted">
                      Ranked chess on Hemi Testnet with on-chain ELO.
                    </p>
                    <div className="surface-inset mt-6 space-y-2 p-4 text-left">
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-faint">Network</span>
                        <span className="font-semibold text-ink">Hemi Testnet</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-faint">Chain ID</span>
                        <span className="font-mono font-semibold text-ink">743111</span>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Right column: Online Users + Live Games + Recent Form */}
              <div className="space-y-4 sm:space-y-6">
                {/* Online Users + Live Games: Stacked on mobile, stacked on larger screens */}
                <div className="space-y-4 sm:space-y-6">
                  {/* Online Users */}
                  {isConnected && address && (
                    <OnlineUsers 
                      currentUserId={address.toLowerCase()}
                      onChallenge={handleChallenge}
                    />
                  )}

                  {/* Live Games */}
                  <LiveGames onSpectate={handleSpectate} />
                </div>

                {/* Recent Form - moved below Online Users and Live Games */}
                <section className="surface p-6 sm:p-8">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-faint">Recent form</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    {isLoadingHistory ? (
                      // Loading skeleton
                      Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-8 w-8 animate-pulse rounded-lg bg-slate-700/50"
                        />
                      ))
                    ) : matchHistory && matchHistory.length > 0 ? (
                      // Live match history
                      matchHistory.map((match, i) => (
                        <span
                          key={match.game_id}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                            match.outcome === 'W'
                              ? 'bg-teal/20 text-teal'
                              : match.outcome === 'L'
                              ? 'bg-rose-500/20 text-rose-500'
                              : 'bg-slate-600/50 text-slate-400'
                          }`}
                          title={`${match.outcome === 'W' ? 'Win' : match.outcome === 'L' ? 'Loss' : 'Draw'} - ${match.elo_change >= 0 ? '+' : ''}${match.elo_change} Elo`}
                        >
                          {match.outcome}
                        </span>
                      ))
                    ) : (
                      // No games yet
                      <span className="text-sm text-ink-muted">(last 4 games)</span>
                    )}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <a
                      href="/profile"
                      className="flex-1 rounded-xl border border-line bg-[var(--surface-strong)] px-4 py-2.5 text-center text-sm font-medium text-ink transition-colors hover:border-line-strong"
                    >
                      View profile
                    </a>
                    <a
                      href="/admin"
                      className="flex-1 rounded-xl border border-line bg-[var(--surface-strong)] px-4 py-2.5 text-center text-sm font-medium text-ink transition-colors hover:border-line-strong"
                    >
                      Leaderboard
                    </a>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* ── Searching ───────────────────────────────────── */}
        {gameState === 'finding' && (
          <SearchingCard
            queuePosition={queuePosition}
            timeControlLabel={`${timeControl?.label} ${timeControl?.sub}`}
            onCancel={handleCancelMatchmaking}
          />
        )}

        {/* ── Reconnecting ────────────────────────────────── */}
        {reconnecting && gameState !== 'playing' && (
          <div className="surface-modal mx-auto mt-6 max-w-md p-8 text-center">
            <div className="relative mx-auto mb-5 h-16 w-16">
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[var(--accent-orange)]" />
            </div>
            <h2 className="text-xl font-bold text-ink">Reconnecting to game…</h2>
            <p className="mt-1 text-sm text-ink-muted">Checking for an active session</p>
          </div>
        )}

        {/* ── Game view: three columns ────────────────────── */}
        {gameState === 'playing' && orientation && (
          <div className="space-y-4">
            {opponentDisconnected && disconnectWarning && (
              <div className="surface flex items-center gap-3 border-[color-mix(in_oklab,var(--accent-amber)_60%,transparent)] p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--accent-amber)_20%,transparent)] text-amber-accent">
                  !
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-amber-accent">{disconnectWarning}</p>
                  <p className="text-xs text-ink-muted">Auto-win countdown: {disconnectCountdown}s</p>
                </div>
              </div>
            )}

            {opponentOfferedDraw && (
              <div className="surface grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-teal/40 p-4">
                <p className="min-w-0 truncate text-sm font-bold text-teal">
                  Opponent offered a draw
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={handleAcceptDraw}
                    className="rounded-lg bg-teal px-4 py-2 text-sm font-bold text-canvas hover:bg-teal-strong transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={handleDeclineDraw}
                    className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink-muted hover:bg-surface-strong transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {drawOffered && !opponentOfferedDraw && (
              <div className="surface grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-amber-accent/40 p-4">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-accent/20 text-amber-accent text-xs font-bold">
                  ?
                </span>
                <p className="min-w-0 text-sm font-bold text-amber-accent">
                  Draw offer sent - waiting for opponent's response
                </p>
                <div className="flex shrink-0">
                  <button
                    onClick={() => {
                      if (gameId && socket) {
                        socket.emit('cancel_draw_offer', { gameId });
                        setDrawOffered(false);
                        setStatus('Draw offer cancelled');
                        setTimeout(() => setStatus(`Playing as ${orientation}`), 2000);
                      }
                    }}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-muted hover:bg-surface-strong transition-colors"
                  >
                    Cancel Offer
                  </button>
                </div>
              </div>
            )}

            {/* Compact horizontal layout: Left Player | Board | Right Player + Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,20rem)] gap-3 sm:gap-4 items-start">
              
              {/* Left sidebar - Opponent info */}
              <div className="order-2 lg:order-1 space-y-3">
                <PlayerCard
                  name={opponentName}
                  color={opponentColor}
                  elo={opponentElo}
                  avatar={opponentAvatar}
                  timeMs={opponentTime}
                  active={!myTurn}
                  accent="rose"
                />
                
                {/* Game info on desktop */}
                <div className="hidden lg:block surface p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-3">Game Info</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">Time</span>
                      <span className="font-semibold text-ink">{timeControl?.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">Moves</span>
                      <span className="font-semibold text-ink">{moveHistory.length}</span>
                    </div>
                  </div>
                  {checkSquare && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-[color-mix(in_oklab,var(--accent-danger)_15%,transparent)] px-2 py-1.5">
                      <AlertTriangle className="h-3 w-3 text-danger-accent" />
                      <span className="text-xs font-bold text-danger-accent">Check!</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Center - Chessboard only */}
              <div className="order-1 lg:order-2">
                <div className="surface p-2 sm:p-3">
                  <div className="mx-auto" style={{ maxWidth: '500px' }}>
                    <Chessboard
                      options={{
                        position: fen,
                        onPieceDrop: ({ piece, sourceSquare, targetSquare }) => {
                          setSelectedSquare(null);
                          if (!targetSquare) return false;
                          return handleMove(sourceSquare, targetSquare, piece.pieceType);
                        },
                        onSquareClick: ({ square }) => handleSquareClick(square),
                        darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
                        lightSquareStyle: { backgroundColor: 'var(--board-light)' },
                        boardOrientation: orientation,
                        showNotation: true,
                        squareStyles: squareStyles as never,
                      }}
                    />
                  </div>
                </div>
                
                {/* Turn indicator below board */}
                <div className="text-center mt-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold ${
                      myTurn
                        ? 'bg-orange-soft text-orange'
                        : 'bg-[var(--surface-strong)] text-ink-muted'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${myTurn ? 'animate-pulse bg-orange' : 'bg-[var(--text-faint)]'}`}
                    />
                    {myTurn ? 'Your turn' : "Opponent's turn"}
                  </span>
                </div>
              </div>

              {/* Right sidebar - Your player card + Controls + Moves */}
              <div className="order-3 lg:order-3 space-y-3">
                {/* Your player card */}
                <PlayerCard
                  name={playerDisplayName || 'You'}
                  color={orientation}
                  elo={myGameElo || userStats.elo}
                  avatar={myAvatar}
                  wallet={walletBadge}
                  timeMs={myTime}
                  active={myTurn}
                />
                
                {/* Game Controls */}
                <div className="surface p-3">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Actions</h4>
                  <div className="space-y-2">
                    <button
                      onClick={handleOfferDraw}
                      disabled={drawOffered}
                      className="w-full rounded-lg border border-amber-accent/40 bg-amber-accent/10 px-3 py-2 text-sm font-semibold text-amber-accent transition-colors hover:bg-amber-accent/20 disabled:cursor-not-allowed disabled:border-line disabled:bg-[var(--surface-strong)] disabled:text-ink-faint"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <Handshake className="h-3.5 w-3.5" />
                        {drawOffered ? "Draw offered" : "Offer draw"}
                      </span>
                    </button>
                    <button
                      onClick={handleResign}
                      className="w-full rounded-lg border border-danger-accent/40 bg-danger-accent/10 px-3 py-2 text-sm font-semibold text-danger-accent transition-colors hover:bg-danger-accent/20"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <Flag className="h-3.5 w-3.5" />
                        Resign game
                      </span>
                    </button>
                  </div>
                </div>
                
                {/* Move history */}
                <div className="surface p-3">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Moves</h4>
                  <div className="max-h-[300px] overflow-y-auto pr-1">
                    {moveHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <List className="mb-2 h-6 w-6 text-ink-faint opacity-60" />
                        <p className="text-xs text-ink-faint">No moves yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[2rem_1fr_1fr] gap-x-1 text-sm">
                        {(() => {
                          const rows: { n: number; white?: string; black?: string }[] = [];
                          moveHistory.forEach((m, i) => {
                            const label = m.san || `${m.from ?? ""}${m.to ?? ""}`;
                            const idx = Math.floor(i / 2);
                            if (!rows[idx]) rows[idx] = { n: idx + 1 };
                            if (i % 2 === 0) rows[idx]!.white = label;
                            else rows[idx]!.black = label;
                          });
                          
                          const lastMoveIdx = moveHistory.length - 1;
                          const lastRow = Math.floor(lastMoveIdx / 2);
                          const isLastWhite = lastMoveIdx % 2 === 0;
                          
                          return rows.map((row, idx) => {
                            const isCurrentWhite = idx === lastRow && isLastWhite;
                            const isCurrentBlack = idx === lastRow && !isLastWhite && row.black;
                            
                            return (
                              <div key={row.n} className="contents group">
                                <span className="py-1.5 font-mono text-[11px] font-semibold text-ink-faint">{row.n}.</span>
                                <span 
                                  className={`cursor-pointer rounded px-2 py-1.5 font-mono text-xs text-ink transition-colors hover:bg-orange-soft hover:text-orange ${
                                    isCurrentWhite ? 'bg-orange-soft text-orange font-semibold' : ''
                                  }`}
                                >
                                  {row.white ?? ""}
                                </span>
                                <span 
                                  className={`cursor-pointer rounded px-2 py-1.5 font-mono text-xs text-ink transition-colors hover:bg-orange-soft hover:text-orange ${
                                    isCurrentBlack ? 'bg-orange-soft text-orange font-semibold' : ''
                                  }`}
                                >
                                  {row.black ?? ""}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Game over ───────────────────────────────────── */}
        {gameState === 'finished' && (() => {
          const isWin = gameOverMsg.toLowerCase().includes('you won');
          const isDraw = gameOverMsg.toLowerCase().includes('draw');
          
          const outcomeText = isWin ? "Victory" : isDraw ? "Draw" : "Defeat";
          const outcomeColor = isWin ? "text-teal" : isDraw ? "text-slate-300" : "text-danger-accent";
          
          const eloChangeColor = eloChange == null ? "text-ink-muted" : eloChange > 0 ? "text-teal" : eloChange < 0 ? "text-danger-accent" : "text-ink-muted";
          const newElo = (myGameElo && eloChange != null) ? myGameElo + eloChange : null;

          return (
            <div className="mx-auto max-w-7xl">
                <header className="mb-4 text-center">
                    <h1 className={`text-4xl font-extrabold tracking-tight ${outcomeColor}`}>{outcomeText}</h1>
                    <p className="mt-1 text-lg text-ink-muted">{gameOverMsg}</p>
                </header>

                <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_minmax(0,24rem)]">
                    {/* Left: Final Board with player cards */}
                    <div className="surface p-3 sm:p-4 space-y-3">
                        <PlayerCard
                            name={opponentName}
                            color={opponentColor}
                            elo={opponentElo}
                            avatar={opponentAvatar}
                            timeMs={opponentTime}
                            active={false}
                            accent="rose"
                        />
                        <div className="mx-auto" style={{ maxWidth: '500px' }}>
                            <Chessboard
                                position={fen}
                                boardOrientation={orientation || 'white'}
                                customSquareStyles={squareStyles}
                                arePiecesDraggable={false}
                            />
                        </div>
                        <PlayerCard
                            name={playerDisplayName || 'You'}
                            color={orientation ?? 'white'}
                            elo={myGameElo || userStats.elo}
                            avatar={myAvatar}
                            wallet={walletBadge}
                            timeMs={myTime}
                            active={false}
                        />
                    </div>

                    {/* Right: Game Analysis & Actions */}
                    <div className="space-y-4 sm:space-y-6">
                        {eloChange != null && (
                          <div className="surface p-4 sm:p-6 text-center">
                              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">ELO Change</h3>
                              <div className="mt-2">
                                  <span className={`text-4xl font-bold ${eloChangeColor}`}>
                                      {eloChange >= 0 ? `+${eloChange}` : eloChange}
                                  </span>
                                  {newElo != null && <span className="ml-2 text-lg text-ink-muted">({newElo} ELO)</span>}
                              </div>
                          </div>
                        )}

                        <div className="surface p-4 sm:p-6">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-faint mb-3">Game Summary</h3>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-ink-muted">Moves</span>
                                <span className="font-bold text-ink">{moveHistory.length}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-ink-muted">Time Control</span>
                                <span className="font-bold text-ink">{timeControl?.label}</span>
                            </div>
                             <div className="flex justify-between text-sm">
                                <span className="text-ink-muted">Result</span>
                                <span className="font-bold text-ink">{gameOverMsg}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={handlePlayAgain}
                                className="w-full rounded-xl bg-orange px-6 py-3 text-base font-extrabold text-canvas transition-transform hover:-translate-y-0.5"
                            >
                                Play Again
                            </button>
                            <a
                                href="/profile"
                                className="block w-full text-center rounded-xl border border-line bg-surface-strong px-6 py-3 text-sm font-semibold text-ink hover:bg-surface-hover transition-colors"
                            >
                                View Profile
                            </a>
                        </div>
                    </div>
                </div>
            </div>
          );
        })()}
      </main>

      {/* Learn Chess Modal */}
      <LearnChessModal 
        isOpen={showLearnModal} 
        onClose={() => setShowLearnModal(false)} 
      />
    </div>
  );
}

