import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema } from '@/utils/validation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { LoginFormData } from '@/types';

export function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      navigate('/');
    } catch {
      toast.error('Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch {
      toast.error('Error al iniciar sesión con Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 relative">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="Px4Dx3L" className="h-12 mx-auto" />
          <p className="text-gray-500 dark:text-gray-400 mt-2">Iniciá sesión para continuar</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
              <Input label="Contraseña" type="password" {...register('password')} error={errors.password?.message} />
              <Button type="submit" loading={loading} className="w-full">
                Iniciar sesión
              </Button>
            </form>
            <div className="my-4 flex items-center gap-3">
              <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
              <span className="text-sm text-gray-400 dark:text-gray-500">o</span>
              <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
            </div>
            <Button variant="secondary" onClick={handleGoogle} disabled={loading} className="w-full">
              Continuar con Google
            </Button>
            <div className="mt-4 text-center text-sm space-y-2">
              <Link to="/forgot-password" className="text-blue-600 hover:underline block">
                ¿Olvidaste tu contraseña?
              </Link>
              <p className="text-gray-500 dark:text-gray-400">
                ¿No tenés cuenta?{' '}
                <Link to="/register" className="text-blue-600 hover:underline">
                  Registrate
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
