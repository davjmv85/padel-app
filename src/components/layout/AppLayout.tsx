import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Trophy,
  Users,
  User,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export function AppLayout() {
  const { appUser, isStaff, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const playerNav: NavItem[] = [
    { label: 'Eventos', path: '/', icon: <Calendar className="h-5 w-5" /> },
    { label: 'Mis Inscripciones', path: '/my-registrations', icon: <ClipboardList className="h-5 w-5" /> },
    { label: 'Ranking', path: '/ranking', icon: <Trophy className="h-5 w-5" /> },
    { label: 'Mi Perfil', path: '/profile', icon: <User className="h-5 w-5" /> },
  ];

  const staffNav: NavItem[] = [
    { label: 'Dashboard', path: '/admin', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'Gestión Eventos', path: '/admin/events', icon: <Calendar className="h-5 w-5" /> },
    { label: 'Eventos', path: '/', icon: <Calendar className="h-5 w-5" /> },
    { label: 'Mis Inscripciones', path: '/my-registrations', icon: <ClipboardList className="h-5 w-5" /> },
    { label: 'Ranking', path: '/ranking', icon: <Trophy className="h-5 w-5" /> },
    { label: 'Mi Perfil', path: '/profile', icon: <User className="h-5 w-5" /> },
  ];

  const adminNav: NavItem[] = appUser?.role === 'admin'
    ? [...staffNav, { label: 'Colaboradores', path: '/admin/collaborators', icon: <Users className="h-5 w-5" /> }]
    : staffNav;

  const navItems = isStaff ? adminNav : playerNav;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#101828]">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
          <Menu className="h-6 w-6" />
        </button>
        <img src="/logo.svg" alt="Px4Dx3L" className="h-12 mx-auto" />
        <div className="w-10" />
      </div>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 shadow-xl z-50">
            <SidebarContent
              navItems={navItems}
              currentPath={location.pathname}
              userName={appUser?.displayName || ''}
              onLogout={handleLogout}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <SidebarContent
            navItems={navItems}
            currentPath={location.pathname}
            userName={appUser?.displayName || ''}
            onLogout={handleLogout}
          />
        </div>

        {/* Main content */}
        <main className="flex-1 lg:ml-64 relative min-h-screen">
          <div className="padel-court-bg">
            <div className="padel-ball" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  navItems,
  currentPath,
  userName,
  onLogout,
  onClose,
}: {
  navItems: NavItem[];
  currentPath: string;
  userName: string;
  onLogout: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700">
        <img src="/logo.svg" alt="Px4Dx3L" className="h-12 mx-auto" />
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = currentPath === item.path || (item.path !== '/' && item.path !== '/admin' && currentPath.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-4">
        <ThemeToggle />
        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 truncate">{userName}</div>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
