import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Trophy, DollarSign } from 'lucide-react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

interface Stats {
  totalEvents: number;
  publishedEvents: number;
  totalRegistrations: number;
  paidRegistrations: number;
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [eventsSnap, publishedSnap, regsSnap, paidSnap] = await Promise.all([
          getCountFromServer(collection(db, 'events')),
          getCountFromServer(query(collection(db, 'events'), where('status', '==', 'published'))),
          getCountFromServer(query(collection(db, 'registrations'), where('status', '==', 'active'))),
          getCountFromServer(query(collection(db, 'registrations'), where('paymentStatus', '==', 'paid'))),
        ]);
        setStats({
          totalEvents: eventsSnap.data().count,
          publishedEvents: publishedSnap.data().count,
          totalRegistrations: regsSnap.data().count,
          paidRegistrations: paidSnap.data().count,
        });
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) return <Spinner />;

  const cards = [
    { label: 'Eventos totales', value: stats?.totalEvents ?? 0, icon: <Calendar className="h-6 w-6" />, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30', link: '/admin/events' },
    { label: 'Eventos publicados', value: stats?.publishedEvents ?? 0, icon: <Calendar className="h-6 w-6" />, color: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30', link: '/admin/events' },
    { label: 'Inscripciones activas', value: stats?.totalRegistrations ?? 0, icon: <Users className="h-6 w-6" />, color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/30', link: '/admin/events' },
    { label: 'Pagos confirmados', value: stats?.paidRegistrations ?? 0, icon: <DollarSign className="h-6 w-6" />, color: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30', link: '/admin/events' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} to={card.link}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="py-5">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${card.color}`}>{card.icon}</div>
                  <div>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="mt-8">
        <Link to="/ranking" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline font-medium">
          <Trophy className="h-5 w-5" /> Ver ranking
        </Link>
      </div>
    </div>
  );
}
