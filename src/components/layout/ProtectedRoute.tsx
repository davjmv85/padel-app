import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, appUser, loading, isEmailVerified } = useAuth();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!appUser) return <Spinner />;
  if (!isEmailVerified) return <VerifyEmailPage />;
  if (allowedRoles && !allowedRoles.includes(appUser.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
