import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ClipboardList } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getUserRegistrations } from '../services/registrationService';
import { getEvent } from '@/features/events/services/eventService';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PAYMENT_STATUSES, PAYMENT_STATUS_COLORS } from '@/utils/constants';
import type { Registration, PadelEvent } from '@/types';

interface RegistrationWithEvent extends Registration {
  event?: PadelEvent;
}

export function MyRegistrationsPage() {
  const { appUser } = useAuth();
  const [registrations, setRegistrations] = useState<RegistrationWithEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    getUserRegistrations(appUser.id).then(async (regs) => {
      const withEvents = await Promise.all(
        regs.map(async (reg) => {
          const event = await getEvent(reg.eventId);
          return { ...reg, event: event || undefined };
        })
      );
      // Hide registrations whose event was deleted
      setRegistrations(withEvents.filter(r => r.event));
      setLoading(false);
    });
  }, [appUser]);

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Mis Inscripciones</h1>
      {registrations.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-12 w-12" />}
          title="No tenés inscripciones"
          description="Inscribite en un evento para verlo acá"
        />
      ) : (
        <div className="space-y-3">
          {registrations.map((reg) => (
            <Link key={reg.id} to={`/events/${reg.eventId}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <h3 className="font-semibold">{reg.event?.name || 'Evento'}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {reg.event?.date?.toDate ? reg.event.date.toDate().toLocaleDateString('es-AR') : ''} - {reg.event?.time}
                        </p>
                      </div>
                    </div>
                    <Badge className={PAYMENT_STATUS_COLORS[reg.paymentStatus]}>
                      {PAYMENT_STATUSES[reg.paymentStatus]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
