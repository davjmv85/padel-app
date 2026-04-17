import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { getRankings } from '../services/rankingService';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { RankingEntry } from '@/types';

export function RankingPage() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRankings().then(setRankings).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Ranking</h1>
      <Card>
        <CardHeader>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ranking individual por partidos ganados</p>
        </CardHeader>
        <CardContent>
          {rankings.length === 0 ? (
            <EmptyState
              icon={<Trophy className="h-12 w-12" />}
              title="Sin datos de ranking"
              description="El ranking se generará cuando se carguen resultados de partidos"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400 w-12">#</th>
                    <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Jugador</th>
                    <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PJ</th>
                    <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PG</th>
                    <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((entry, idx) => (
                    <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2.5">
                        <span className={`font-bold ${idx < 3 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-2.5 font-medium">{entry.userName}</td>
                      <td className="py-2.5 text-center">{entry.matchesPlayed}</td>
                      <td className="py-2.5 text-center">{entry.matchesWon}</td>
                      <td className="py-2.5 text-center font-bold">{entry.totalPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
