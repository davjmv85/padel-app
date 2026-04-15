import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { calculateGroupStandings, rankNonQualifiedPairs } from '@/utils/americano';
import type { PadelEvent, EventPair, EventGroup, Match } from '@/types';

interface Props {
  event: PadelEvent;
  pairs: EventPair[];
  groups: EventGroup[];
  matches: Match[];
}

export function AmericanoStandingsTab({ event, pairs, groups, matches }: Props) {
  const config = event.americanoConfig;
  const pairNameMap = new Map(pairs.map(p => [p.id, `${p.player1Name} / ${p.player2Name}`]));

  const groupMatches = matches.filter(m => m.phase === 'group');
  const repechajeMatches = matches.filter(m => m.phase === 'repechaje');

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-4">
          <EmptyState title="Sin grupos" description="Distribuí las parejas en grupos para ver posiciones" />
        </CardContent>
      </Card>
    );
  }

  const renderStandingsTable = (standings: ReturnType<typeof calculateGroupStandings>, qualifiedCount?: number) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400 w-10">#</th>
            <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Pareja</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PJ</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PG</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PP</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">GG</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">GP</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">Game±</th>
            <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, idx) => {
            const gameDiff = s.gamesWon - s.gamesLost;
            const isQualified = qualifiedCount != null && idx < qualifiedCount;
            return (
              <tr key={s.pairId} className={`border-b border-gray-100 dark:border-gray-700 ${isQualified ? 'bg-green-50 dark:bg-green-900/10' : ''}`}>
                <td className="py-2.5">
                  <span className={`font-bold ${isQualified ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    {idx + 1}
                  </span>
                </td>
                <td className="py-2.5 font-medium">
                  {s.pairName}
                  {isQualified && <Badge className="ml-2 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">Clasifica</Badge>}
                </td>
                <td className="py-2.5 text-center">{s.played}</td>
                <td className="py-2.5 text-center">{s.won}</td>
                <td className="py-2.5 text-center">{s.lost}</td>
                <td className="py-2.5 text-center">{s.gamesWon}</td>
                <td className="py-2.5 text-center">{s.gamesLost}</td>
                <td className="py-2.5 text-center">{gameDiff > 0 ? '+' : ''}{gameDiff}</td>
                <td className="py-2.5 text-center font-bold">{s.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Group standings */}
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
                  {renderStandingsTable(standings, config?.directQualifiers)}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Non-qualified ranking (determines bye) */}
      {config && groupMatches.length > 0 && (event.americanoPhase === 'repechaje' || event.americanoPhase === 'elimination' || event.americanoPhase === 'finished') && (() => {
        const ranked = rankNonQualifiedPairs(groups, groupMatches, config.directQualifiers, pairNameMap);
        if (ranked.length === 0) return null;
        const repechajePairIds = new Set(repechajeMatches.flatMap(m => [m.pairAId, m.pairBId]));
        return (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Tabla general de no clasificados
            </h3>
            <Card>
              <CardContent className="py-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400 w-10">#</th>
                        <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Pareja</th>
                        <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PJ</th>
                        <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PG</th>
                        <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PP</th>
                        <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">GG</th>
                        <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">GP</th>
                        <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">Game±</th>
                        <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">Pts</th>
                        <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Vía</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((s, idx) => {
                        const gameDiff = s.gamesWon - s.gamesLost;
                        const isBye = !repechajePairIds.has(s.pairId);
                        return (
                          <tr key={s.pairId} className={`border-b border-gray-100 dark:border-gray-700 ${isBye ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                            <td className="py-2.5">
                              <span className="font-bold text-gray-400 dark:text-gray-500">{idx + 1}</span>
                            </td>
                            <td className="py-2.5 font-medium">
                              {s.pairName}
                              {isBye && <Badge className="ml-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">Bye</Badge>}
                            </td>
                            <td className="py-2.5 text-center">{s.played}</td>
                            <td className="py-2.5 text-center">{s.won}</td>
                            <td className="py-2.5 text-center">{s.lost}</td>
                            <td className="py-2.5 text-center">{s.gamesWon}</td>
                            <td className="py-2.5 text-center">{s.gamesLost}</td>
                            <td className="py-2.5 text-center">{gameDiff > 0 ? '+' : ''}{gameDiff}</td>
                            <td className="py-2.5 text-center font-bold">{s.points}</td>
                            <td className="py-2.5">
                              {isBye
                                ? <span className="text-blue-600 dark:text-blue-400 text-xs font-medium">Bye</span>
                                : <span className="text-gray-500 dark:text-gray-400 text-xs">Repechaje</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        PJ: jugados · PG/PP: partidos ganados/perdidos · GG/GP: games ganados/perdidos · Pts: puntos (1 por victoria)
      </p>
    </div>
  );
}
