import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar, MoreVertical, Settings, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '../hooks/useEvents';
import { deleteEvent } from '../services/eventService';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EVENT_STATUSES, EVENT_STATUS_COLORS } from '@/utils/constants';
import toast from 'react-hot-toast';

function ActionMenu({ eventId, isAdmin, onDelete }: { eventId: string; isAdmin: boolean; onDelete: () => void }) {
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
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <MoreVertical className="h-5 w-5 text-gray-500 dark:text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
          <button
            onClick={() => { navigate(`/admin/events/${eventId}`); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Settings className="h-4 w-4" /> Gestionar
          </button>
          <button
            onClick={() => { navigate(`/admin/events/${eventId}/edit`); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Pencil className="h-4 w-4" /> Editar
          </button>
          {isAdmin && (
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminEventListPage() {
  const { isAdmin } = useAuth();
  const { events, loading, refresh } = useEvents(true);
  const navigate = useNavigate();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteEvent(deleteId);
      toast.success('Evento eliminado');
      setDeleteId(null);
      refresh();
    } catch {
      toast.error('Error al eliminar el evento');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Eventos</h1>
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
                      onDelete={() => setDeleteId(event.id)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar evento"
        message="¿Estás seguro de que querés eliminar este evento? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        loading={deleting}
      />
    </div>
  );
}
