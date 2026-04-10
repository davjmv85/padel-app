import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm<{ email: string }>();

  const onSubmit = async (data: { email: string }) => {
    setLoading(true);
    try {
      await resetPassword(data.email);
      toast.success('Si el email existe, recibirás un enlace para restablecer tu contraseña');
    } catch {
      toast.error('Error al enviar el email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 relative">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="Px4Dx3L Hub" className="h-12 mx-auto" />
          <p className="text-gray-500 dark:text-gray-400 mt-2">Recuperá tu contraseña</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input label="Email" type="email" {...register('email', { required: true })} />
              <Button type="submit" loading={loading} className="w-full">
                Enviar enlace
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              <Link to="/login" className="text-blue-600 hover:underline">
                Volver al login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
