import type { AmericanoConfig, Match, EventGroup } from '@/types';
import { countSets } from './format';

// --- Validation ---

export interface ConfigValidation {
  errors: string[];
  warnings: string[];
  summary: { groupCount: number; pairsPerGroup: number; totalPairs: number } | null;
}

export function validateAmericanoConfig(config: AmericanoConfig, totalPairs: number): ConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { groupCount } = config;

  if (groupCount !== 4) {
    errors.push('El formato Americano requiere exactamente 4 grupos');
    return { errors, warnings, summary: null };
  }

  if (totalPairs < 16) {
    errors.push(`Se necesitan 16 parejas (hay ${totalPairs}). El formato es: 4 grupos de 4 parejas.`);
    return { errors, warnings, summary: null };
  }

  if (totalPairs > 16) {
    warnings.push(`Hay ${totalPairs} parejas. Solo se usarán 16 (4 por grupo).`);
  }

  if (totalPairs % 4 !== 0) {
    errors.push(`Las parejas deben ser múltiplo de 4 para grupos iguales (hay ${totalPairs})`);
    return { errors, warnings, summary: null };
  }

  const pairsPerGroup = Math.floor(totalPairs / groupCount);
  if (pairsPerGroup !== 4) {
    errors.push(`El formato requiere exactamente 4 parejas por grupo (resultarían ${pairsPerGroup})`);
    return { errors, warnings, summary: null };
  }

  return { errors, warnings, summary: { groupCount, pairsPerGroup, totalPairs } };
}

// --- Group distribution ---

export function distributeInGroups(pairIds: string[], groupCount: number): string[][] {
  const shuffled = [...pairIds].sort(() => Math.random() - 0.5);
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  shuffled.forEach((id, i) => {
    groups[i % groupCount].push(id);
  });
  return groups;
}

// --- Group fixture generation ---

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Round 1: random pairing of 4 pairs → 2 matches (all play once).
 */
export function generateGroupRound1(pairIds: string[]): [string, string][] {
  const s = shuffle(pairIds);
  return [[s[0], s[1]], [s[2], s[3]]];
}

/**
 * Round 2: winners play each other (defines 1st/2nd), losers play each other (defines 3rd/4th).
 * Returns null if round 1 isn't complete.
 */
export function generateGroupRound2(
  round1Matches: Pick<Match, 'pairAId' | 'pairBId' | 'winnerId'>[]
): [string, string][] | null {
  if (round1Matches.some(m => !m.winnerId)) return null;
  const winners = round1Matches.map(m => m.winnerId);
  const losers = round1Matches.map(m => m.winnerId === m.pairAId ? m.pairBId : m.pairAId);
  return [
    [winners[0], winners[1]], // 1st vs 2nd
    [losers[0], losers[1]],   // 3rd vs 4th
  ];
}

// --- Group standings ---

export interface GroupStanding {
  pairId: string;
  pairName: string;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  points: number;
}

export function calculateGroupStandings(
  groupPairIds: string[],
  matches: Array<Pick<Match, 'pairAId' | 'pairBId' | 'scoreA' | 'scoreB' | 'winnerId' | 'round'>>,
  pairNameMap: Map<string, string>
): GroupStanding[] {
  const stats = new Map<string, GroupStanding>();

  for (const pairId of groupPairIds) {
    stats.set(pairId, {
      pairId,
      pairName: pairNameMap.get(pairId) || 'Desconocida',
      played: 0, won: 0, lost: 0,
      setsWon: 0, setsLost: 0,
      gamesWon: 0, gamesLost: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    if (!m.winnerId) continue;
    const statA = stats.get(m.pairAId);
    const statB = stats.get(m.pairBId);
    if (!statA || !statB) continue;

    const counts = countSets(m.scoreA);
    if (!counts) continue;

    statA.played++; statB.played++;
    statA.setsWon += counts.won; statA.setsLost += counts.lost;
    statA.gamesWon += counts.gamesWon; statA.gamesLost += counts.gamesLost;
    statB.setsWon += counts.lost; statB.setsLost += counts.won;
    statB.gamesWon += counts.gamesLost; statB.gamesLost += counts.gamesWon;

    if (m.winnerId === m.pairAId) {
      statA.won++; statA.points++; statB.lost++;
    } else {
      statB.won++; statB.points++; statA.lost++;
    }
  }

  const standings = Array.from(stats.values());

  // When round 2 is complete, positions are defined by those match results:
  // winner of the winners-match → 1st, loser → 2nd
  // winner of the losers-match → 3rd, loser → 4th
  const round1 = matches.filter(m => m.round === 1);
  const round2 = matches.filter(m => m.round === 2);
  if (round2.length === 2 && round2.every(m => !!m.winnerId) && round1.length > 0) {
    const round1WinnerIds = new Set(round1.map(m => m.winnerId).filter(Boolean) as string[]);
    const winnersMatch = round2.find(m => round1WinnerIds.has(m.pairAId) && round1WinnerIds.has(m.pairBId));
    const losersMatch = round2.find(m => m !== winnersMatch);
    if (winnersMatch?.winnerId && losersMatch?.winnerId) {
      const pos1 = winnersMatch.winnerId;
      const pos2 = winnersMatch.pairAId === pos1 ? winnersMatch.pairBId : winnersMatch.pairAId;
      const pos3 = losersMatch.winnerId;
      const pos4 = losersMatch.pairAId === pos3 ? losersMatch.pairBId : losersMatch.pairAId;
      const rankMap = new Map([[pos1, 0], [pos2, 1], [pos3, 2], [pos4, 3]]);
      standings.sort((a, b) => (rankMap.get(a.pairId) ?? 4) - (rankMap.get(b.pairId) ?? 4));
      return standings;
    }
  }

  // Fallback (round 2 not yet complete): sort by points → game diff → h2h
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = a.gamesWon - a.gamesLost;
    const diffB = b.gamesWon - b.gamesLost;
    if (diffB !== diffA) return diffB - diffA;
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    const h2h = matches.find(
      m => m.winnerId &&
        ((m.pairAId === a.pairId && m.pairBId === b.pairId) ||
         (m.pairAId === b.pairId && m.pairBId === a.pairId))
    );
    if (h2h) return h2h.winnerId === a.pairId ? -1 : 1;
    return 0;
  });

  return standings;
}

// --- Octavos generation ---

export interface OctavoSlot {
  pairAId: string;
  pairBId: string;
  bracketPosition: number; // 1-4: A vs C, 5-8: B vs D
}

/**
 * Generates octavos from group standings.
 * Groups 1(A) vs 3(C): A1vC4, A2vC3, A3vC2, A4vC1 → positions 1-4
 * Groups 2(B) vs 4(D): B1vD4, B2vD3, B3vD2, B4vD1 → positions 5-8
 */
export function generateOctavos(
  groups: EventGroup[],
  groupMatches: Match[],
  pairNameMap: Map<string, string>
): OctavoSlot[] {
  const sorted = [...groups].sort((a, b) => a.groupNumber - b.groupNumber);
  const standingsByGroup = sorted.map(g => {
    const gm = groupMatches.filter(m => m.groupNumber === g.groupNumber);
    return calculateGroupStandings(g.pairIds, gm, pairNameMap).map(s => s.pairId);
  });

  // Need exactly 4 groups
  const [A, B, C, D] = standingsByGroup;
  if (!A || !B || !C || !D) return [];

  const slots: OctavoSlot[] = [];
  for (let i = 0; i < 4; i++) {
    slots.push({ pairAId: A[i], pairBId: C[3 - i], bracketPosition: i + 1 });
  }
  for (let i = 0; i < 4; i++) {
    slots.push({ pairAId: B[i], pairBId: D[3 - i], bracketPosition: i + 5 });
  }
  return slots;
}

// --- Elimination bracket advancement ---

/**
 * Plans next elimination round pairs from current round results.
 * - Octavos (round 1) → Cuartos: AC winner[i] vs BD winner[i+4]
 * - Cuartos+ → sequential pairing: winner[0] vs winner[1], winner[2] vs winner[3], ...
 */
export function planNextEliminationRound(
  currentRoundMatches: Match[],
  currentRound: number
): [string, string][] {
  const sorted = [...currentRoundMatches].sort((a, b) => (a.bracketPosition || 0) - (b.bracketPosition || 0));
  const winners = sorted.map(m => m.winnerId).filter(Boolean) as string[];

  if (currentRound === 1) {
    // octavos → cuartos: pair AC with BD
    const pairs: [string, string][] = [];
    const half = winners.length / 2;
    for (let i = 0; i < half; i++) {
      pairs.push([winners[i], winners[i + half]]);
    }
    return pairs;
  }

  // cuartos → semis → final: sequential pairing
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < winners.length; i += 2) {
    pairs.push([winners[i], winners[i + 1]]);
  }
  return pairs;
}
