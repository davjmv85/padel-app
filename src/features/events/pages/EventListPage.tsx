import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, DollarSign } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getEvents } from '../services/eventService';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { EVENT_STATUSES, EVENT_STATUS_COLORS } from '@/utils/constants';
import type { PadelEvent } from '@/types';

export function EventListPage() {
  const { isStaff } = useAuth();
  const [events, setEvents] = useState<PadelEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents(false)
      .then(setEvents)
      .catch((err) => console.error('Error loading events:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Eventos disponibles</h1>
      {events.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-12 w-12" />}
          title="No hay eventos disponibles"
          description="Todavía no se publicaron eventos. ¡Volvé pronto!"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link key={event.id} to={isStaff ? `/admin/events/${event.id}` : `/events/${event.id}`}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-lg">{event.name}</h3>
                    <Badge className={EVENT_STATUS_COLORS[event.status]}>
                      {EVENT_STATUSES[event.status]}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {event.date?.toDate ? event.date.toDate().toLocaleDateString('es-AR') : ''} - {event.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{event.currentRegistrations}/{event.maxCapacity} inscriptos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      <span>${event.price}</span>
                    </div>
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
