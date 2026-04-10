import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, RefreshCw, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export function VerifyEmailPage() {
  const { user, logout, resendVerification, reloadUser } = useAuth();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerification();
      toast.success('Email de verificación reenviado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al reenviar');
    } finally {
      setResending(false);
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      await reloadUser();
      // reloadUser updates the user state; if emailVerified, ProtectedRoute will let them through
      if (user?.emailVerified) {
        toast.success('¡Email verificado!');
      } else {
        toast.error('Todavía no verificamos el email. Revisá tu bandeja de entrada o carpeta de correo no deseado / spam.');
      }
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 relative">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="Px4Dx3L Hub" className="h-12 mx-auto" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">Verificá tu email</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Te enviamos un mail a{' '}
                <span className="font-medium text-gray-900 dark:text-gray-100 break-all">{user?.email}</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Abrí el mail y hacé click en el link para activar tu cuenta.
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-100 mt-3">
                Si no lo encontrás, revisá tu carpeta de <strong>spam / correo no deseado</strong>.
              </p>
            </div>

            <div className="space-y-3">
              <Button onClick={handleCheck} loading={checking} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Ya verifiqué mi email
              </Button>
              <Button variant="secondary" onClick={handleResend} loading={resending} className="w-full">
                Reenviar email
              </Button>
              <Button variant="ghost" onClick={handleLogout} className="w-full">
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar sesión
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
