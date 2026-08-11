/**
 * Standard Elo Rating Calculation (Backend)
 * Identical logic to frontend for consistency
 * 
 * Formula: E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 * New Rating: R_A' = R_A + K * (S_A - E_A)
 */

const K_FACTOR = 32;

/**
 * Calculate expected score for a player
 * 
 * @param {number} playerRating - Current Elo rating of the player
 * @param {number} opponentRating - Current Elo rating of the opponent
 * @returns {number} Expected score (probability of winning, 0-1)
 */
function calculateExpectedScore(playerRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Calculate Elo rating change for a player
 * 
 * @param {number} playerRating - Current Elo rating of the player
 * @param {number} opponentRating - Current Elo rating of the opponent
 * @param {'win' | 'loss' | 'draw'} outcome - Game outcome from player's perspective
 * @returns {{ newRating: number, change: number }} New rating and change amount
 */
function calculateEloChange(playerRating, opponentRating, outcome) {
  // Convert outcome to score
  let actualScore;
  switch (outcome) {
    case 'win':
      actualScore = 1;
      break;
    case 'draw':
      actualScore = 0.5;
      break;
    case 'loss':
      actualScore = 0;
      break;
    default:
      throw new Error(`Invalid outcome: ${outcome}`);
  }

  // Calculate expected score
  const expectedScore = calculateExpectedScore(playerRating, opponentRating);

  // Calculate rating change
  const change = Math.round(K_FACTOR * (actualScore - expectedScore));

  // Calculate new rating (minimum 0)
  const newRating = Math.max(0, playerRating + change);

  return {
    newRating,
    change,
  };
}

/**
 * Calculate Elo changes for both players in a match
 * 
 * @param {number} whiteRating - Current Elo rating of white player
 * @param {number} blackRating - Current Elo rating of black player
 * @param {'white' | 'black' | 'draw'} winner - Game result
 * @returns {{ white: { newRating: number, change: number }, black: { newRating: number, change: number } }}
 */
function calculateMatchElo(whiteRating, blackRating, winner) {
  let whiteOutcome, blackOutcome;

  if (winner === 'white') {
    whiteOutcome = 'win';
    blackOutcome = 'loss';
  } else if (winner === 'black') {
    whiteOutcome = 'loss';
    blackOutcome = 'win';
  } else if (winner === 'draw') {
    whiteOutcome = 'draw';
    blackOutcome = 'draw';
  } else {
    throw new Error(`Invalid winner: ${winner}`);
  }

  return {
    white: calculateEloChange(whiteRating, blackRating, whiteOutcome),
    black: calculateEloChange(blackRating, whiteRating, blackOutcome),
  };
}

/**
 * Get absolute Elo delta for smart contract call
 * Contract expects positive amount, with isWin flag to determine mint/burn
 * 
 * @param {number} eloChange - Signed Elo change (+/-)
 * @returns {number} Absolute value of change
 */
function getAbsoluteEloDelta(eloChange) {
  return Math.abs(eloChange);
}

module.exports = {
  K_FACTOR,
  calculateExpectedScore,
  calculateEloChange,
  calculateMatchElo,
  getAbsoluteEloDelta,
};
