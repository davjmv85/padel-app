import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { calculateGroupStandings } from '@/utils/americano';
import type { PadelEvent, EventPair, EventGroup, Match } from '@/types';

interface Props {
  event: PadelEvent;
  pairs: EventPair[];
  groups: EventGroup[];
  matches: Match[];
}

// Octavos matchup description per position (1-indexed rank within group)
const OCTAVOS_LABEL: Record<number, string> = {
  1: 'vs 4° del grupo cruzado',
  2: 'vs 3° del grupo cruzado',
  3: 'vs 2° del grupo cruzado',
  4: 'vs 1° del grupo cruzado',
};

export function AmericanoStandingsTab({ pairs, groups, matches }: Props) {
  const pairNameMap = new Map(pairs.map(p => [p.id, `${p.player1Name} / ${p.player2Name}`]));
  const groupMatches = matches.filter(m => m.phase === 'group');

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-4">
          <EmptyState title="Sin grupos" description="Distribuí las parejas en grupos para ver posiciones" />
        </CardContent>
      </Card>
    );
  }

  const renderStandingsTable = (standings: ReturnType<typeof calculateGroupStandings>) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400 w-8">#</th>
            <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Pareja</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PJ</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PG</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PP</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">GG</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">GP</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">Game±</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">Pts</th>
            <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Octavos</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, idx) => {
            const rank = idx + 1;
            const gameDiff = s.gamesWon - s.gamesLost;
            return (
              <tr key={s.pairId} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2.5">
                  <span className="font-bold text-gray-500 dark:text-gray-400">{rank}</span>
                </td>
                <td className="py-2.5 font-medium">
                  {s.pairName}
                  {rank <= 2 && (
                    <Badge className="ml-2 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                      {rank === 1 ? '1°' : '2°'}
                    </Badge>
                  )}
                </td>
                <td className="py-2.5 text-center">{s.played}</td>
                <td className="py-2.5 text-center">{s.won}</td>
                <td className="py-2.5 text-center">{s.lost}</td>
                <td className="py-2.5 text-center">{s.gamesWon}</td>
                <td className="py-2.5 text-center">{s.gamesLost}</td>
                <td className="py-2.5 text-center">{gameDiff > 0 ? '+' : ''}{gameDiff}</td>
                <td className="py-2.5 text-center font-bold">{s.points}</td>
                <td className="py-2.5 text-xs text-gray-400 dark:text-gray-500 hidden sm:table-cell">
                  {OCTAVOS_LABEL[rank]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Posiciones por grupo
        </h3>
        <div className="space-y-4">
          {groups.map(group => {
            const gm = groupMatches.filter(m => m.groupNumber === group.groupNumber);
            const standings = calculateGroupStandings(group.pairIds, gm, pairNameMap);
            return (
              <Card key={group.id}>
                <CardContent className="py-4">
                  <h4 className="text-sm font-semibold mb-3">
                    Grupo {String.fromCharCode(64 + group.groupNumber)}
                  </h4>
                  {renderStandingsTable(standings)}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        PJ: jugados · PG/PP: partidos ganados/perdidos · GG/GP: games ganados/perdidos · Pts: puntos (1 por victoria)
      </p>
    </div>
  );
}
