import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar, MoreVertical, Settings, Pencil, Trash2, Copy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '../hooks/useEvents';
import { deleteEventCascade, duplicateEvent } from '../services/eventService';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EVENT_STATUSES, EVENT_STATUS_COLORS, TOURNAMENT_TYPES } from '@/utils/constants';
import toast from 'react-hot-toast';

function ActionMenu({ eventId, isAdmin, isClosed, onDelete, onDuplicate }: { eventId: string; isAdmin: boolean; isClosed: boolean; onDelete: () => void; onDuplicate: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.preventDefault(); setOpen(!open); }}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        <MoreVertical className="h-5 w-5 text-gray-500 dark:text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
          <button
            onClick={() => { navigate(`/admin/events/${eventId}`); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <Settings className="h-4 w-4" /> {isClosed ? 'Ver' : 'Gestionar'}
          </button>
          {!isClosed && (
            <button
              onClick={() => { navigate(`/admin/events/${eventId}/edit`); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <Pencil className="h-4 w-4" /> Editar
            </button>
          )}
          <button
            onClick={() => { onDuplicate(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <Copy className="h-4 w-4" /> Duplicar
          </button>
          {isAdmin && !isClosed && (
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          )}
          {isClosed && (
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">Evento cerrado (final)</p>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminEventListPage() {
  const { isAdmin, appUser } = useAuth();
  const { events, loading, refresh } = useEvents(true);
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmText.trim() !== deleteTarget.name.trim()) {
      toast.error('El nombre no coincide');
      return;
    }
    setDeleting(true);
    try {
      await deleteEventCascade(deleteTarget.id);
      toast.success('Evento eliminado (inscripciones, parejas, partidos y ranking actualizados)');
      setDeleteTarget(null);
      setDeleteConfirmText('');
      refresh();
    } catch (err) {
      console.error('deleteEventCascade failed:', err);
      const msg = err instanceof Error ? err.message : 'Error al eliminar el evento';
      toast.error(`Error al eliminar: ${msg}`);
    } finally {
      setDeleting(false);
    }
  };

  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteConfirmText('');
  };

  const handleDuplicate = async (eventId: string) => {
    if (!appUser || duplicating) return;
    setDuplicating(eventId);
    const tid = toast.loading('Duplicando evento...');
    try {
      const newId = await duplicateEvent(eventId, appUser.id, appUser.email, appUser.displayName);
      toast.success('Evento duplicado', { id: tid });
      refresh();
      navigate(`/admin/events/${newId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al duplicar', { id: tid });
    } finally {
      setDuplicating(null);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gestión Eventos</h1>
        <Button onClick={() => navigate('/admin/events/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo evento
        </Button>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-12 w-12" />}
          title="No hay eventos"
          description="Creá tu primer evento para empezar"
          action={
            <Button onClick={() => navigate('/admin/events/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Crear evento
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <Link to={`/admin/events/${event.id}`} className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{event.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {event.date?.toDate ? event.date.toDate().toLocaleDateString('es-AR') : ''} - {event.time} | {event.location}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {TOURNAMENT_TYPES[event.tournamentType]}
                    </p>
                  </Link>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                      {event.currentRegistrations}/{event.maxCapacity}
                    </span>
                    <Badge className={EVENT_STATUS_COLORS[event.status]}>
                      {EVENT_STATUSES[event.status]}
                    </Badge>
                    <ActionMenu
                      eventId={event.id}
                      isAdmin={isAdmin}
                      isClosed={event.status === 'closed'}
                      onDelete={() => setDeleteTarget({ id: event.id, name: event.name })}
                      onDuplicate={() => handleDuplicate(event.id)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!deleteTarget} onClose={closeDelete} title="Eliminar evento">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Esta acción <strong>no se puede deshacer</strong>. Se van a borrar inscripciones, parejas, partidos y grupos del evento, y se recalculará el ranking global.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Para confirmar, escribí el nombre del evento: <strong>{deleteTarget?.name}</strong>
          </p>
          <Input
            placeholder={deleteTarget?.name || ''}
            value={deleteConfirmText}
            onChange={e => setDeleteConfirmText(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeDelete}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
              disabled={!deleteTarget || deleteConfirmText.trim() !== deleteTarget.name.trim()}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
