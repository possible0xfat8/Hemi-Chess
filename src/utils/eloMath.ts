/**
 * Standard Elo Rating Calculation
 * Used by both frontend (for display) and backend oracle (for settlement)
 * 
 * Formula: E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 * New Rating: R_A' = R_A + K * (S_A - E_A)
 * 
 * Where:
 * - R_A, R_B = Current ratings of players A and B
 * - E_A = Expected score of player A (probability of winning)
 * - S_A = Actual score (1 = win, 0.5 = draw, 0 = loss)
 * - K = K-factor (sensitivity of rating changes)
 */

export const K_FACTOR = 32

export type GameOutcome = 'win' | 'loss' | 'draw'

/**
 * Calculate expected score for a player
 * 
 * @param playerRating - Current Elo rating of the player
 * @param opponentRating - Current Elo rating of the opponent
 * @returns Expected score (probability of winning, 0-1)
 */
export function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
}

/**
 * Calculate Elo rating change for a player
 * 
 * @param playerRating - Current Elo rating of the player
 * @param opponentRating - Current Elo rating of the opponent
 * @param outcome - Game outcome from player's perspective
 * @returns Object with new rating and change amount
 */
export function calculateEloChange(
  playerRating: number,
  opponentRating: number,
  outcome: GameOutcome
): { newRating: number; change: number } {
  // Convert outcome to score
  let actualScore: number
  switch (outcome) {
    case 'win':
      actualScore = 1
      break
    case 'draw':
      actualScore = 0.5
      break
    case 'loss':
      actualScore = 0
      break
  }

  // Calculate expected score
  const expectedScore = calculateExpectedScore(playerRating, opponentRating)

  // Calculate rating change
  const change = Math.round(K_FACTOR * (actualScore - expectedScore))

  // Calculate new rating (minimum 0)
  const newRating = Math.max(0, playerRating + change)

  return {
    newRating,
    change,
  }
}

/**
 * Calculate Elo changes for both players in a match
 * 
 * @param whiteRating - Current Elo rating of white player
 * @param blackRating - Current Elo rating of black player
 * @param winner - Game result: 'white', 'black', or 'draw'
 * @returns Elo changes for both players
 */
export function calculateMatchElo(
  whiteRating: number,
  blackRating: number,
  winner: 'white' | 'black' | 'draw'
): {
  white: { newRating: number; change: number }
  black: { newRating: number; change: number }
} {
  let whiteOutcome: GameOutcome
  let blackOutcome: GameOutcome

  if (winner === 'white') {
    whiteOutcome = 'win'
    blackOutcome = 'loss'
  } else if (winner === 'black') {
    whiteOutcome = 'loss'
    blackOutcome = 'win'
  } else {
    whiteOutcome = 'draw'
    blackOutcome = 'draw'
  }

  return {
    white: calculateEloChange(whiteRating, blackRating, whiteOutcome),
    black: calculateEloChange(blackRating, whiteRating, blackOutcome),
  }
}

/**
 * Get absolute Elo delta for smart contract call
 * Contract expects positive amount, with isWin flag to determine mint/burn
 * 
 * @param eloChange - Signed Elo change (+/-)
 * @returns Absolute value of change
 */
export function getAbsoluteEloDelta(eloChange: number): number {
  return Math.abs(eloChange)
}
