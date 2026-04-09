import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, MapPin, Users, DollarSign, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { getEvent } from '../services/eventService';
import { getEventRegistrations, registerForEvent, cancelRegistration, addToWaitlist } from '@/features/registrations/services/registrationService';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EVENT_STATUSES, EVENT_STATUS_COLORS } from '@/utils/constants';
import type { PadelEvent, Registration } from '@/types';

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { appUser } = useAuth();
  const [event, setEvent] = useState<PadelEvent | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    if (!eventId) return;
    try {
      const [ev, regs] = await Promise.all([getEvent(eventId), getEventRegistrations(eventId)]);
      setEvent(ev);
      setRegistrations(regs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  if (loading || !event) return <Spinner />;

  const myRegistration = registrations.find((r) => r.userId === appUser?.id);
  const isRegistered = !!myRegistration;
  const isFull = event.currentRegistrations >= event.maxCapacity;
  const canRegister = event.status === 'published' && !isRegistered && !isFull;
  const spotsLeft = event.maxCapacity - event.currentRegistrations;

  const handleRegister = async () => {
    if (!appUser || !eventId) return;
    setActionLoading(true);
    try {
      await registerForEvent(eventId, appUser);
      toast.success('¡Te inscribiste exitosamente!');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al inscribirse');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!myRegistration || !eventId) return;
    setActionLoading(true);
    try {
      await cancelRegistration(myRegistration.id, eventId);
      toast.success('Inscripción cancelada');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cancelar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWaitlist = async () => {
    if (!appUser || !eventId) return;
    setActionLoading(true);
    try {
      await addToWaitlist(eventId, appUser.id, appUser.email);
      toast.success('Te avisaremos cuando se libere un lugar');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al agregar a la lista de espera');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <h1 className="text-2xl font-bold">{event.name}</h1>
            <Badge className={EVENT_STATUS_COLORS[event.status]}>
              {EVENT_STATUSES[event.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <div className="flex items-center gap-3 text-gray-600">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-400">Fecha y hora</p>
                <p className="font-medium text-gray-900">
                  {event.date?.toDate ? event.date.toDate().toLocaleDateString('es-AR') : ''} - {event.time}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <MapPin className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-400">Lugar</p>
                <p className="font-medium text-gray-900">{event.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <Users className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-400">Inscriptos</p>
                <p className="font-medium text-gray-900">
                  {event.currentRegistrations}/{event.maxCapacity}
                  {spotsLeft > 0 && <span className="text-green-600 ml-2">({spotsLeft} disponibles)</span>}
                  {isFull && <span className="text-red-600 ml-2">(Completo)</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <DollarSign className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-400">Precio</p>
                <p className="font-medium text-gray-900">${event.price}</p>
              </div>
            </div>
          </div>

          {event.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-1">Descripción</h3>
              <p className="text-gray-700">{event.description}</p>
            </div>
          )}

          <div className="flex gap-3">
            {canRegister && (
              <Button onClick={handleRegister} loading={actionLoading}>
                Inscribirme
              </Button>
            )}
            {isRegistered && event.status === 'published' && (
              <Button variant="danger" onClick={handleCancel} loading={actionLoading}>
                Cancelar inscripción
              </Button>
            )}
            {isFull && !isRegistered && event.status === 'published' && (
              <Button variant="secondary" onClick={handleWaitlist} loading={actionLoading}>
                <Bell className="h-4 w-4 mr-2" />
                Avisarme cuando haya lugar
              </Button>
            )}
            {isRegistered && (
              <Badge className="bg-green-100 text-green-700 self-center">Ya estás inscripto</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
