import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { ProfilePage } from '@/features/auth/pages/ProfilePage';
import { EventListPage } from '@/features/events/pages/EventListPage';
import { EventDetailPage } from '@/features/events/pages/EventDetailPage';
import { AdminEventListPage } from '@/features/events/pages/AdminEventListPage';
import { AdminEventDetailPage } from '@/features/events/pages/AdminEventDetailPage';
import { EventFormPage } from '@/features/events/pages/EventFormPage';
import { MyRegistrationsPage } from '@/features/registrations/pages/MyRegistrationsPage';
import { RankingPage } from '@/features/ranking/pages/RankingPage';
import { CollaboratorsPage } from '@/features/collaborators/pages/CollaboratorsPage';
import { PlayersPage } from '@/features/players/pages/PlayersPage';

function HomeRoute() {
  const { isStaff } = useAuth();
  return isStaff ? <Navigate to="/admin/events" replace /> : <EventListPage />;
}

export const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },

  // Player routes
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/', element: <HomeRoute /> },
      { path: '/events', element: <EventListPage /> },
      { path: '/events/:eventId', element: <EventDetailPage /> },
      { path: '/my-registrations', element: <MyRegistrationsPage /> },
      { path: '/ranking', element: <RankingPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },

  // Admin/Collaborator routes
  {
    element: (
      <ProtectedRoute allowedRoles={['admin', 'collaborator']}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/admin', element: <Navigate to="/admin/events" replace /> },
      { path: '/admin/events', element: <AdminEventListPage /> },
      { path: '/admin/events/new', element: <EventFormPage /> },
      { path: '/admin/events/:eventId', element: <AdminEventDetailPage /> },
      { path: '/admin/events/:eventId/edit', element: <EventFormPage /> },
      { path: '/admin/players', element: <PlayersPage /> },
    ],
  },

  // Admin only
  {
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/admin/collaborators', element: <CollaboratorsPage /> },
    ],
  },
]);
