import type { AmericanoConfig } from '@/types';
import { countSets } from './format';

// --- Validation ---

export interface ConfigValidation {
  errors: string[];
  warnings: string[];
  summary: {
    pairsPerGroup: number[];
    repechajePool: number;
    totalElimination: number;
    bracketSize: number;
    byes: number;
  } | null;
}

export function validateAmericanoConfig(config: AmericanoConfig, totalPairs: number): ConfigValidation {
  const { minMatches, groupCount, directQualifiers } = config;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (totalPairs < 2) {
    errors.push('Se necesitan al menos 2 parejas');
    return { errors, warnings, summary: null };
  }
  if (totalPairs < groupCount * 2) {
    errors.push(`Se necesitan al menos ${groupCount * 2} parejas para ${groupCount} grupos (hay ${totalPairs})`);
    return { errors, warnings, summary: null };
  }

  const baseSize = Math.floor(totalPairs / groupCount);
  const extra = totalPairs % groupCount;
  const smallestGroup = baseSize;
  const largestGroup = extra > 0 ? baseSize + 1 : baseSize;

  const pairsPerGroup: number[] = [];
  for (let i = 0; i < groupCount; i++) {
    pairsPerGroup.push(i < extra ? largestGroup : smallestGroup);
  }

  if (minMatches > smallestGroup - 1) {
    errors.push(`Con ${smallestGroup} parejas en el grupo más chico, máximo ${smallestGroup - 1} partidos por pareja (pediste ${minMatches})`);
  }

  if (directQualifiers >= smallestGroup) {
    errors.push(`Clasificados directos (${directQualifiers}) deben ser menos que parejas del grupo más chico (${smallestGroup})`);
  }

  const totalDirect = directQualifiers * groupCount;
  const repechajePool = totalPairs - totalDirect;

  if (repechajePool <= 0) {
    errors.push('Todos clasifican directo, no hay repechaje. Bajá los clasificados directos por grupo.');
  }

  if (errors.length > 0) return { errors, warnings, summary: null };

  if (repechajePool % 2 !== 0) {
    warnings.push(`Repechaje con ${repechajePool} parejas (impar): una recibirá bye`);
  }

  const repechajeWinners = Math.ceil(repechajePool / 2);
  const totalElimination = totalDirect + repechajeWinners;
  const bracketSize = nextPowerOf2(totalElimination);
  const byes = bracketSize - totalElimination;

  if (byes > 0) {
    warnings.push(`Eliminatoria: ${totalElimination} parejas → cuadro de ${bracketSize} con ${byes} byes`);
  }

  if (extra > 0) {
    warnings.push(`Grupos desiguales: ${extra} grupo(s) de ${largestGroup} y ${groupCount - extra} de ${smallestGroup}`);
  }

  return { errors, warnings, summary: { pairsPerGroup, repechajePool, totalElimination, bracketSize, byes } };
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

// --- Round-robin schedule ---

export function generateRoundRobinSchedule(teamIds: string[]): [string, string][][] {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push('__BYE__');
  const n = teams.length;
  const rounds: [string, string][][] = [];

  for (let r = 0; r < n - 1; r++) {
    const roundMatches: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];
      if (home !== '__BYE__' && away !== '__BYE__') {
        roundMatches.push([home, away]);
      }
    }
    rounds.push(roundMatches);
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  return rounds;
}

export function generateGroupFixture(pairIds: string[], matchesPerPair: number): [string, string][] {
  const schedule = generateRoundRobinSchedule(pairIds);
  const played = new Map<string, number>(pairIds.map(id => [id, 0]));
  const matches: [string, string][] = [];
  for (const round of schedule) {
    if (pairIds.every(id => (played.get(id) ?? 0) >= matchesPerPair)) break;
    for (const [a, b] of round) {
      matches.push([a, b]);
      played.set(a, (played.get(a) ?? 0) + 1);
      played.set(b, (played.get(b) ?? 0) + 1);
    }
  }
  return matches;
}

// --- Bracket ---

export function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function generateBracketSeeding(size: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const nextSeeds: number[] = [];
    const nextSize = seeds.length * 2;
    for (const seed of seeds) {
      nextSeeds.push(seed);
      nextSeeds.push(nextSize + 1 - seed);
    }
    seeds = nextSeeds;
  }
  return seeds;
}

export interface BracketSlot {
  bracketRound: number;
  bracketPosition: number;
  pairAId: string | null;
  pairBId: string | null;
}

export function generateEliminationBracket(
  qualifiedPairs: { pairId: string; seed: number }[]
): BracketSlot[] {
  const size = nextPowerOf2(qualifiedPairs.length);
  const seeding = generateBracketSeeding(size);

  const seedMap = new Map<number, string>();
  const sorted = [...qualifiedPairs].sort((a, b) => a.seed - b.seed);
  sorted.forEach((p, i) => seedMap.set(i + 1, p.pairId));

  const slots: BracketSlot[] = [];
  for (let i = 0; i < size; i += 2) {
    const seedA = seeding[i];
    const seedB = seeding[i + 1];
    slots.push({
      bracketRound: 1,
      bracketPosition: Math.floor(i / 2) + 1,
      pairAId: seedMap.get(seedA) || null,
      pairBId: seedMap.get(seedB) || null,
    });
  }

  return slots;
}

// --- Non-qualified ranking (cross-group) ---

export function rankNonQualifiedPairs(
  groups: { pairIds: string[]; groupNumber: number }[],
  groupMatches: Array<{
    pairAId: string;
    pairBId: string;
    scoreA: string;
    scoreB: string;
    winnerId: string;
    groupNumber?: number;
  }>,
  directQualifiers: number,
  pairNameMap: Map<string, string>
): GroupStanding[] {
  const allNonQualified: GroupStanding[] = [];

  for (const group of groups) {
    const gMatches = groupMatches.filter(m => m.groupNumber === group.groupNumber);
    const standings = calculateGroupStandings(group.pairIds, gMatches, pairNameMap);
    allNonQualified.push(...standings.slice(directQualifiers));
  }

  allNonQualified.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gameDiffA = a.gamesWon - a.gamesLost;
    const gameDiffB = b.gamesWon - b.gamesLost;
    if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    return 0;
  });

  return allNonQualified;
}

// --- Qualification routes ---

export type QualificationRoute = 'directo' | 'repechaje' | 'bye';

export function getQualificationRoutes(
  groups: { pairIds: string[]; groupNumber: number }[],
  groupMatches: Array<{
    pairAId: string;
    pairBId: string;
    scoreA: string;
    scoreB: string;
    winnerId: string;
    groupNumber?: number;
  }>,
  repechajeMatches: Array<{ pairAId: string; pairBId: string; winnerId: string }>,
  directQualifiers: number,
  pairNameMap: Map<string, string>
): Map<string, QualificationRoute> {
  const routes = new Map<string, QualificationRoute>();

  for (const group of groups) {
    const gMatches = groupMatches.filter(m => m.groupNumber === group.groupNumber);
    const standings = calculateGroupStandings(group.pairIds, gMatches, pairNameMap);
    for (let i = 0; i < directQualifiers && i < standings.length; i++) {
      routes.set(standings[i].pairId, 'directo');
    }
  }

  for (const m of repechajeMatches) {
    if (m.winnerId) {
      routes.set(m.winnerId, 'repechaje');
    }
  }

  const repechajePairIds = new Set(repechajeMatches.flatMap(m => [m.pairAId, m.pairBId]));
  for (const group of groups) {
    const gMatches = groupMatches.filter(m => m.groupNumber === group.groupNumber);
    const standings = calculateGroupStandings(group.pairIds, gMatches, pairNameMap);
    for (const s of standings.slice(directQualifiers)) {
      if (!repechajePairIds.has(s.pairId) && !routes.has(s.pairId)) {
        routes.set(s.pairId, 'bye');
      }
    }
  }

  return routes;
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
  matches: Array<{
    pairAId: string;
    pairBId: string;
    scoreA: string;
    scoreB: string;
    winnerId: string;
  }>,
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
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gameDiffA = a.gamesWon - a.gamesLost;
    const gameDiffB = b.gamesWon - b.gamesLost;
    if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    // H2H
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
