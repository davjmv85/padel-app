import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar } from 'lucide-react';
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
                  <Link to={`/admin/events/${event.id}`} className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-semibold">{event.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {event.date?.toDate ? event.date.toDate().toLocaleDateString('es-AR') : ''} - {event.time} | {event.location}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {event.currentRegistrations}/{event.maxCapacity}
                    </span>
                    <Badge className={EVENT_STATUS_COLORS[event.status]}>
                      {EVENT_STATUSES[event.status]}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/events/${event.id}/edit`)}>
                      Editar
                    </Button>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(event.id)}>
                        Eliminar
                      </Button>
                    )}
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
