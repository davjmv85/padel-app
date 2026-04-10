/**
 * Format a number as price with thousand separators using dots.
 * Example: 22000 → "22.000"
 */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value);
}

/**
 * Returns the user's display name: nickname if set, else "First Last".
 */
export function buildDisplayName(firstName: string, lastName: string, nickname?: string): string {
  const nick = nickname?.trim();
  if (nick) return nick;
  return `${firstName} ${lastName}`.trim();
}

/**
 * Calculate the inverse of a padel score.
 * Example: "6-4 6-3" → "4-6 3-6"
 */
export function inverseScore(score: string): string {
  if (!score?.trim()) return '';
  return score
    .trim()
    .split(/\s+/)
    .map((set) => {
      const [a, b] = set.split('-').map((s) => s.trim());
      if (a === undefined || b === undefined) return set;
      return `${b}-${a}`;
    })
    .join(' ');
}

/**
 * Determine the winner pair based on the score for pair A.
 * Returns 'A' or 'B' based on which pair won more sets.
 * Returns null if the score is invalid or tied.
 */
export function determineWinner(scoreA: string): 'A' | 'B' | null {
  const counts = countSets(scoreA);
  if (!counts) return null;
  if (counts.won === counts.lost) return null;
  return counts.won > counts.lost ? 'A' : 'B';
}

/**
 * Count sets and games won/lost from the perspective of pair A.
 * Example: "6-4 6-3" → { setsWon: 2, setsLost: 0, gamesWon: 12, gamesLost: 7 }
 * Returns null if invalid.
 */
export function countSets(scoreA: string): { won: number; lost: number; gamesWon: number; gamesLost: number } | null {
  if (!scoreA?.trim()) return null;
  let won = 0;
  let lost = 0;
  let gamesWon = 0;
  let gamesLost = 0;
  const sets = scoreA.trim().split(/\s+/);
  for (const set of sets) {
    const [a, b] = set.split('-').map((s) => parseInt(s.trim(), 10));
    if (isNaN(a) || isNaN(b)) return null;
    gamesWon += a;
    gamesLost += b;
    if (a > b) won++;
    else if (b > a) lost++;
  }
  return { won, lost, gamesWon, gamesLost };
}
