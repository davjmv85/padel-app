import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { collection, doc, updateDoc, serverTimestamp, query, where, getDocs, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { profileSchema } from '@/utils/validation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { PLAYER_POSITIONS, ROLES } from '@/utils/constants';
import { buildDisplayName } from '@/utils/format';
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
      nickname: appUser?.nickname || '',
      telegramUsername: appUser?.telegramUsername || '',
      position: appUser?.position || 'indistinto',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    if (!appUser) return;
    setLoading(true);
    try {
      const nickname = data.nickname?.trim() || null;
      const telegramUsername = data.telegramUsername?.trim().replace(/^@/, '') || null;
      const newDisplayName = buildDisplayName(data.firstName, data.lastName, data.nickname);
      await updateDoc(doc(db, 'users', appUser.id), {
        firstName: data.firstName,
        lastName: data.lastName,
        nickname,
        telegramUsername,
        position: data.position,
        displayName: newDisplayName,
        updatedAt: serverTimestamp(),
      });

      // Propagate cached userName/displayName to dependent collections in parallel
      await Promise.all([
        // registrations
        (async () => {
          try {
            const regSnap = await getDocs(
              query(
                collection(db, 'registrations'),
                where('userId', '==', appUser.id),
                where('status', '==', 'active')
              )
            );
            await Promise.all(
              regSnap.docs.map((d) =>
                updateDoc(d.ref, {
                  userName: newDisplayName,
                  userPosition: data.position,
                  updatedAt: serverTimestamp(),
                })
              )
            );
          } catch (err) {
            console.error('Error updating registrations cache:', err);
          }
        })(),

        // event_pairs (player1 slot)
        (async () => {
          try {
            const snap = await getDocs(
              query(collection(db, 'event_pairs'), where('player1Id', '==', appUser.id))
            );
            await Promise.all(
              snap.docs.map((d) =>
                updateDoc(d.ref, { player1Name: newDisplayName, updatedAt: serverTimestamp() })
              )
            );
          } catch (err) {
            console.error('Error updating pairs (player1) cache:', err);
          }
        })(),

        // event_pairs (player2 slot)
        (async () => {
          try {
            const snap = await getDocs(
              query(collection(db, 'event_pairs'), where('player2Id', '==', appUser.id))
            );
            await Promise.all(
              snap.docs.map((d) =>
                updateDoc(d.ref, { player2Name: newDisplayName, updatedAt: serverTimestamp() })
              )
            );
          } catch (err) {
            console.error('Error updating pairs (player2) cache:', err);
          }
        })(),

        // rankings (only if the user has a ranking doc)
        (async () => {
          try {
            const rankRef = doc(db, 'rankings', appUser.id);
            const rankSnap = await getDoc(rankRef);
            if (rankSnap.exists()) {
              await updateDoc(rankRef, {
                userName: newDisplayName,
                updatedAt: serverTimestamp(),
              });
            }
          } catch (err) {
            console.error('Error updating ranking cache:', err);
          }
        })(),
      ]);

      toast.success('Perfil actualizado');
    } catch {
      toast.error('Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const positionOptions = Object.entries(PLAYER_POSITIONS).map(([value, label]) => ({ value, label }));

  return (
    <div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Apodo (opcional)" placeholder="Se usa como nombre visible" {...register('nickname')} error={errors.nickname?.message} />
              <Input
                label="Usuario de Telegram (opcional)"
                placeholder="@tuusuario"
                {...register('telegramUsername')}
                error={errors.telegramUsername?.message}
              />
            </div>
            <a
              href="https://t.me/+9vtip5SVhMJmMDEx"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:bg-blue-900/30 transition-colors"
            >
              <span>📲 ¡Unite al grupo de Telegram y enterate de las novedades!</span>
              <span className="shrink-0 font-medium underline">Unirme</span>
            </a>
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
