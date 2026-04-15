import type { EventPair, Match, ReyConfig } from '@/types';
import { createMatch } from '@/features/matches/services/matchService';
import { buildInitialRoundAssignment, planNextRound } from '@/utils/rey';

/**
 * Creates round 1 matches. Returns number of matches created.
 */
export async function generateReyFirstRound(
  eventId: string,
  pairs: EventPair[],
  config: ReyConfig,
  createdBy: string,
  manualAssignment?: Record<string, string[]>
): Promise<{ created: number; resting: string[] }> {
  const { assignments, resting } = buildInitialRoundAssignment(
    pairs.map(p => p.id),
    config.courts,
    config.seedMode,
    manualAssignment
  );
  let created = 0;
  for (const [courtId, [a, b]] of assignments.entries()) {
    const court = config.courts.find(c => c.id === courtId);
    await createMatch(eventId, a, b, createdBy, 1, {
      courtId,
      courtName: court?.name,
    });
    created++;
  }
  return { created, resting };
}

/**
 * Creates next round based on previous round's results and rotation rules.
 */
export async function generateReyNextRound(
  eventId: string,
  pairs: EventPair[],
  allMatches: Match[],
  config: ReyConfig,
  createdBy: string
): Promise<{ created: number; resting: string[] }> {
  const reyMatches = allMatches.filter(m => m.round != null);
  const rounds = Array.from(new Set(reyMatches.map(m => m.round!))).sort((a, b) => a - b);
  const currentRound = rounds.length > 0 ? rounds[rounds.length - 1] : 0;
  const currentRoundMatches = reyMatches.filter(m => m.round === currentRound);
  const nextRoundNumber = currentRound + 1;

  const playingLastRound = new Set<string>();
  for (const m of currentRoundMatches) {
    playingLastRound.add(m.pairAId);
    playingLastRound.add(m.pairBId);
  }
  const previousResting = pairs.map(p => p.id).filter(id => !playingLastRound.has(id));

  const playedCount = new Map<string, number>();
  for (const p of pairs) playedCount.set(p.id, 0);
  for (const m of reyMatches) {
    playedCount.set(m.pairAId, (playedCount.get(m.pairAId) || 0) + 1);
    playedCount.set(m.pairBId, (playedCount.get(m.pairBId) || 0) + 1);
  }

  const plan = planNextRound(
    currentRoundMatches,
    previousResting,
    pairs.map(p => p.id),
    config,
    playedCount
  );

  let created = 0;
  for (const [courtId, [a, b]] of plan.assignments.entries()) {
    const court = config.courts.find(c => c.id === courtId);
    await createMatch(eventId, a, b, createdBy, nextRoundNumber, {
      courtId,
      courtName: court?.name,
    });
    created++;
  }

  return { created, resting: plan.resting };
}
