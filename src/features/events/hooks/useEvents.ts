import { useEffect, useState } from 'react';
import type { PadelEvent } from '@/types';
import { getEvents } from '../services/eventService';

export function useEvents(staffView: boolean) {
  const [events, setEvents] = useState<PadelEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await getEvents(staffView);
      setEvents(data);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [staffView]);

  return { events, loading, refresh };
}
