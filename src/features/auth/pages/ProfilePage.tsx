import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { profileSchema } from '@/utils/validation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { PLAYER_POSITIONS, ROLES } from '@/utils/constants';
import { Badge } from '@/components/ui/Badge';
import type { ProfileFormData } from '@/types';

export function ProfilePage() {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: appUser?.firstName || '',
      lastName: appUser?.lastName || '',
      position: appUser?.position || 'indistinto',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    if (!appUser) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', appUser.id), {
        ...data,
        displayName: `${data.firstName} ${data.lastName}`,
        updatedAt: serverTimestamp(),
      });
      toast.success('Perfil actualizado');
    } catch {
      toast.error('Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const positionOptions = Object.entries(PLAYER_POSITIONS).map(([value, label]) => ({ value, label }));

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mi Perfil</h1>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{appUser?.email}</p>
            </div>
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {ROLES[appUser?.role || 'player']}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nombre" {...register('firstName')} error={errors.firstName?.message} />
              <Input label="Apellido" {...register('lastName')} error={errors.lastName?.message} />
            </div>
            <Select label="Posición" options={positionOptions} {...register('position')} error={errors.position?.message} />
            <Button type="submit" loading={loading}>
              Guardar cambios
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
