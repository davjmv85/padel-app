import { useEffect, useMemo, useState } from 'react';
import { Users as UsersIcon, Search } from 'lucide-react';
import { getAllPlayers } from '../services/playerService';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PLAYER_POSITIONS } from '@/utils/constants';
import type { AppUser } from '@/types';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  collaborator: 'Colaborador',
  player: 'Jugador',
};

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  collaborator: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  player: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export function PlayersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getAllPlayers();
        if (alive) setUsers(data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
    if (!q) return sorted;
    return sorted.filter((u) => {
      return (
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.firstName || '').toLowerCase().includes(q) ||
        (u.lastName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    });
  }, [users, query]);

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Jugadores registrados</h1>

      <Card className="mb-4">
        <CardHeader>
          <h2 className="font-semibold">Buscar</h2>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Nombre, apellido o email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Total: {filtered.length} {filtered.length === 1 ? 'jugador' : 'jugadores'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<UsersIcon className="h-12 w-12" />}
              title="Sin resultados"
              description="No hay jugadores que coincidan con la búsqueda"
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((u) => (
                <div key={u.id} className="flex items-start justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{u.displayName || '—'}</p>
                      <Badge className={ROLE_BADGE[u.role] || ROLE_BADGE.player}>
                        {ROLE_LABEL[u.role] || u.role}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                      {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                  </div>
                  <div className="shrink-0">
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {PLAYER_POSITIONS[u.position] || u.position || '—'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
