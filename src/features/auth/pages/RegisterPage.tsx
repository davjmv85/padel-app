import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { registerSchema } from '@/utils/validation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { PLAYER_POSITIONS } from '@/utils/constants';
import type { RegisterFormData } from '@/types';

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { position: 'indistinto' },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true);
    try {
      await registerUser(data.email, data.password, data.firstName, data.lastName, data.position);
      toast.success('Cuenta creada exitosamente');
      navigate('/');
    } catch {
      toast.error('Error al crear la cuenta. El email puede estar en uso.');
    } finally {
      setLoading(false);
    }
  };

  const positionOptions = Object.entries(PLAYER_POSITIONS).map(([value, label]) => ({ value, label }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Padel App</h1>
          <p className="text-gray-500 mt-2">Creá tu cuenta</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Nombre" {...register('firstName')} error={errors.firstName?.message} />
                <Input label="Apellido" {...register('lastName')} error={errors.lastName?.message} />
              </div>
              <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
              <Input label="Contraseña" type="password" {...register('password')} error={errors.password?.message} />
              <Input label="Confirmar contraseña" type="password" {...register('confirmPassword')} error={errors.confirmPassword?.message} />
              <Select label="Posición" options={positionOptions} {...register('position')} error={errors.position?.message} />
              <Button type="submit" loading={loading} className="w-full">
                Crear cuenta
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-500">
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="text-blue-600 hover:underline">
                Iniciá sesión
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
