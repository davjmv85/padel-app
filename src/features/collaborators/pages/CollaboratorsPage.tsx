import { useEffect, useState } from 'react';
import { Users, Search } from 'lucide-react';
import { getCollaborators, searchUsers, setUserRole } from '../services/collaboratorService';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { AppUser } from '@/types';
import toast from 'react-hot-toast';

export function CollaboratorsPage() {
  const [collaborators, setCollaborators] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const loadCollaborators = async () => {
    setLoading(true);
    try {
      const data = await getCollaborators();
      setCollaborators(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCollaborators(); }, []);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    try {
      const results = await searchUsers(searchEmail.trim());
      setSearchResults(results.filter(u => u.role === 'player'));
    } finally {
      setSearching(false);
    }
  };

  const handleAssign = async (userId: string) => {
    try {
      await setUserRole(userId, 'collaborator');
      toast.success('Colaborador asignado');
      setSearchResults([]);
      setSearchEmail('');
      await loadCollaborators();
    } catch {
      toast.error('Error al asignar colaborador');
    }
  };

  const handleRemove = async () => {
    if (!removeId) return;
    setRemoveLoading(true);
    try {
      await setUserRole(removeId, 'player');
      toast.success('Colaborador removido');
      setRemoveId(null);
      await loadCollaborators();
    } catch {
      toast.error('Error al remover colaborador');
    } finally {
      setRemoveLoading(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Colaboradores</h1>

      {/* Search */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-semibold">Agregar colaborador</h2>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Buscar por email exacto..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} loading={searching}>
              <Search className="h-4 w-4 mr-2" /> Buscar
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{user.displayName}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  <Button size="sm" onClick={() => handleAssign(user.id)}>
                    Hacer colaborador
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Colaboradores actuales</h2>
        </CardHeader>
        <CardContent>
          {collaborators.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="Sin colaboradores"
              description="Buscá un usuario por email para asignarlo como colaborador"
            />
          ) : (
            <div className="space-y-2">
              {collaborators.map((collab) => (
                <div key={collab.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{collab.displayName}</p>
                    <p className="text-sm text-gray-500">{collab.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-purple-100 text-purple-700">Colaborador</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setRemoveId(collab.id)}>
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!removeId}
        onClose={() => setRemoveId(null)}
        onConfirm={handleRemove}
        title="Remover colaborador"
        message="¿Estás seguro? El usuario volverá a ser un jugador común."
        confirmLabel="Remover"
        loading={removeLoading}
      />
    </div>
  );
}
