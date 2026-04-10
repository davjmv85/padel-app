import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { createEvent, getEvent, updateEvent } from '../services/eventService';
import { eventSchema } from '@/utils/validation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EVENT_STATUSES } from '@/utils/constants';
import type { EventFormData } from '@/types';

export function EventFormPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const isEditing = !!eventId;
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(isEditing);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema) as never,
    defaultValues: { status: 'draft' },
  });

  const currentStatus = watch('status');
  const isFinished = currentStatus === 'finished';

  useEffect(() => {
    if (isEditing && eventId) {
      getEvent(eventId).then((ev) => {
        if (ev) {
          reset({
            name: ev.name,
            location: ev.location,
            date: ev.date?.toDate ? ev.date.toDate().toISOString().split('T')[0] : '',
            time: ev.time,
            maxCapacity: ev.maxCapacity,
            price: ev.price,
            description: ev.description || '',
            status: ev.status,
          });
        }
        setPageLoading(false);
      });
    }
  }, [eventId, isEditing, reset]);

  const onSubmit = async (data: EventFormData) => {
    if (!appUser) return;
    setLoading(true);
    try {
      if (isEditing && eventId) {
        await updateEvent(eventId, data);
        toast.success('Evento actualizado');
        navigate(`/admin/events/${eventId}`);
      } else {
        const id = await createEvent(data, appUser.id, appUser.email);
        toast.success('Evento creado');
        navigate(`/admin/events/${id}`);
      }
    } catch {
      toast.error('Error al guardar el evento');
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = Object.entries(EVENT_STATUSES).map(([value, label]) => ({ value, label }));

  if (pageLoading) return <Spinner />;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{isEditing ? 'Editar evento' : 'Nuevo evento'}</h1>
      <Card>
        <CardHeader>
          <p className="text-sm text-gray-500 dark:text-gray-400">Completá los datos del evento</p>
        </CardHeader>
        <CardContent>
          {isFinished && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-300">
              El evento está <strong>finalizado</strong>. Cambiá el estado para poder editar el resto de los campos.
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Nombre" {...register('name')} error={errors.name?.message} disabled={isFinished} />
            <Input label="Lugar" {...register('location')} error={errors.location?.message} disabled={isFinished} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Fecha" type="date" {...register('date')} error={errors.date?.message} disabled={isFinished} />
              <Input label="Hora" type="time" {...register('time')} error={errors.time?.message} disabled={isFinished} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Cupo máximo" type="number" {...register('maxCapacity')} error={errors.maxCapacity?.message} disabled={isFinished} />
              <Input label="Precio ($)" type="number" step="0.01" {...register('price')} error={errors.price?.message} disabled={isFinished} />
            </div>
            <Textarea label="Descripción (opcional)" rows={3} {...register('description')} error={errors.description?.message} disabled={isFinished} />
            <Select label="Estado" options={statusOptions} {...register('status')} error={errors.status?.message} />
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={loading}>
                {isEditing ? 'Guardar cambios' : 'Crear evento'}
              </Button>
              <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
