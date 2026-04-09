import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getEvent } from '../services/eventService';
import { getEventRegistrations, cancelRegistration, updatePaymentStatus } from '@/features/registrations/services/registrationService';
import { getEventPairs, createPair, deletePair } from '@/features/pairs/services/pairService';
import { getEventMatches, createMatch, updateMatch } from '@/features/matches/services/matchService';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { EVENT_STATUSES, EVENT_STATUS_COLORS, PAYMENT_STATUSES, PAYMENT_STATUS_COLORS, PLAYER_POSITIONS } from '@/utils/constants';
import type { PadelEvent, Registration, EventPair, Match } from '@/types';
import toast from 'react-hot-toast';

type Tab = 'info' | 'registrations' | 'payments' | 'pairs' | 'matches';

export function AdminEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [event, setEvent] = useState<PadelEvent | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [pairs, setPairs] = useState<EventPair[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('info');

  // Modal states
  const [cancelRegId, setCancelRegId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [pairModalOpen, setPairModalOpen] = useState(false);
  const [matchModalOpen, setMatchModalOpen] = useState(false);

  // Pair form
  const [pairPlayer1, setPairPlayer1] = useState('');
  const [pairPlayer2, setPairPlayer2] = useState('');
  const [pairLoading, setPairLoading] = useState(false);

  // Match form
  const [matchPairA, setMatchPairA] = useState('');
  const [matchPairB, setMatchPairB] = useState('');
  const [matchScoreA, setMatchScoreA] = useState('');
  const [matchScoreB, setMatchScoreB] = useState('');
  const [matchWinner, setMatchWinner] = useState('');
  const [matchLoading, setMatchLoading] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  const loadData = async () => {
    if (!eventId) return;
    try {
      const [ev, regs, prs, mtchs] = await Promise.all([
        getEvent(eventId),
        getEventRegistrations(eventId),
        getEventPairs(eventId),
        getEventMatches(eventId),
      ]);
      setEvent(ev);
      setRegistrations(regs);
      setPairs(prs);
      setMatches(mtchs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [eventId]);

  if (loading || !event) return <Spinner />;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Información' },
    { key: 'registrations', label: `Inscriptos (${registrations.length})` },
    { key: 'payments', label: 'Pagos' },
    { key: 'pairs', label: `Parejas (${pairs.length})` },
    { key: 'matches', label: `Partidos (${matches.length})` },
  ];

  const handleCancelReg = async () => {
    if (!cancelRegId || !eventId) return;
    setCancelLoading(true);
    try {
      await cancelRegistration(cancelRegId, eventId);
      toast.success('Inscripción cancelada');
      setCancelRegId(null);
      await loadData();
    } catch { toast.error('Error al cancelar'); }
    finally { setCancelLoading(false); }
  };

  const handlePayment = async (regId: string, status: 'pending' | 'paid' | 'cancelled') => {
    if (!appUser) return;
    try {
      await updatePaymentStatus(regId, status, appUser.id);
      toast.success('Estado de pago actualizado');
      await loadData();
    } catch { toast.error('Error al actualizar pago'); }
  };

  const handleCreatePair = async () => {
    if (!eventId || !pairPlayer1 || !pairPlayer2) return;
    setPairLoading(true);
    try {
      const p1 = registrations.find(r => r.userId === pairPlayer1);
      const p2 = registrations.find(r => r.userId === pairPlayer2);
      if (!p1 || !p2) throw new Error('Jugadores no encontrados');
      await createPair(eventId, p1.userId, p1.userName, p2.userId, p2.userName);
      toast.success('Pareja creada');
      setPairModalOpen(false);
      setPairPlayer1('');
      setPairPlayer2('');
      await loadData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al crear pareja'); }
    finally { setPairLoading(false); }
  };

  const handleDeletePair = async (pairId: string) => {
    try {
      await deletePair(pairId);
      toast.success('Pareja eliminada');
      await loadData();
    } catch { toast.error('Error al eliminar pareja'); }
  };

  const handleCreateMatch = async () => {
    if (!eventId || !appUser || !matchPairA || !matchPairB || !matchWinner) return;
    setMatchLoading(true);
    try {
      if (editingMatchId) {
        await updateMatch(editingMatchId, matchScoreA, matchScoreB, matchWinner);
        toast.success('Resultado actualizado');
      } else {
        await createMatch(eventId, matchPairA, matchPairB, matchScoreA, matchScoreB, matchWinner, appUser.id);
        toast.success('Resultado cargado');
      }
      setMatchModalOpen(false);
      resetMatchForm();
      await loadData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error'); }
    finally { setMatchLoading(false); }
  };

  const resetMatchForm = () => {
    setMatchPairA('');
    setMatchPairB('');
    setMatchScoreA('');
    setMatchScoreB('');
    setMatchWinner('');
    setEditingMatchId(null);
  };

  const openEditMatch = (m: Match) => {
    setEditingMatchId(m.id);
    setMatchPairA(m.pairAId);
    setMatchPairB(m.pairBId);
    setMatchScoreA(m.scoreA);
    setMatchScoreB(m.scoreB);
    setMatchWinner(m.winnerId);
    setMatchModalOpen(true);
  };

  const getPairName = (pairId: string) => {
    const p = pairs.find(pr => pr.id === pairId);
    return p ? `${p.player1Name} / ${p.player2Name}` : 'Pareja desconocida';
  };

  const usedPlayerIds = new Set(pairs.flatMap(p => [p.player1Id, p.player2Id]));
  const availablePlayers = registrations.filter(r => !usedPlayerIds.has(r.userId));

  const playerOptions = [
    { value: '', label: 'Seleccionar jugador' },
    ...availablePlayers.map(r => ({ value: r.userId, label: `${r.userName} (${PLAYER_POSITIONS[r.userPosition]})` })),
  ];

  const pairOptions = [
    { value: '', label: 'Seleccionar pareja' },
    ...pairs.map(p => ({ value: p.id, label: `${p.player1Name} / ${p.player2Name}` })),
  ];

  const winnerOptions = [
    { value: '', label: 'Seleccionar ganador' },
    ...(matchPairA ? [{ value: matchPairA, label: getPairName(matchPairA) }] : []),
    ...(matchPairB && matchPairB !== matchPairA ? [{ value: matchPairB, label: getPairName(matchPairB) }] : []),
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {event.date?.toDate ? event.date.toDate().toLocaleDateString('es-AR') : ''} - {event.time} | {event.location}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={EVENT_STATUS_COLORS[event.status]}>{EVENT_STATUSES[event.status]}</Badge>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/admin/events/${eventId}/edit`)}>
            <Pencil className="h-4 w-4 mr-1" /> Editar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Info Tab */}
      {activeTab === 'info' && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400 dark:text-gray-500">Cupo:</span> <span className="font-medium">{event.currentRegistrations}/{event.maxCapacity}</span></div>
              <div><span className="text-gray-400 dark:text-gray-500">Precio:</span> <span className="font-medium">${event.price}</span></div>
              <div><span className="text-gray-400 dark:text-gray-500">Estado:</span> <span className="font-medium">{EVENT_STATUSES[event.status]}</span></div>
              <div><span className="text-gray-400 dark:text-gray-500">Creador:</span> <span className="font-medium">{event.createdBy}</span></div>
            </div>
            {event.description && <p className="text-sm text-gray-600 dark:text-gray-400 pt-2">{event.description}</p>}
          </CardContent>
        </Card>
      )}

      {/* Registrations Tab */}
      {activeTab === 'registrations' && (
        <Card>
          <CardContent className="py-4">
            {registrations.length === 0 ? (
              <EmptyState title="Sin inscriptos" description="Todavía no hay jugadores inscriptos en este evento" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Jugador</th>
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Posición</th>
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Pago</th>
                      <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map(reg => (
                      <tr key={reg.id} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2.5">{reg.userName}</td>
                        <td className="py-2.5">{PLAYER_POSITIONS[reg.userPosition]}</td>
                        <td className="py-2.5">
                          <Badge className={PAYMENT_STATUS_COLORS[reg.paymentStatus]}>
                            {PAYMENT_STATUSES[reg.paymentStatus]}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setCancelRegId(reg.id)}>
                            Dar de baja
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <Card>
          <CardContent className="py-4">
            {registrations.length === 0 ? (
              <EmptyState title="Sin inscriptos" description="No hay pagos para gestionar" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Jugador</th>
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Estado</th>
                      <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map(reg => (
                      <tr key={reg.id} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2.5">{reg.userName}</td>
                        <td className="py-2.5">
                          <Badge className={PAYMENT_STATUS_COLORS[reg.paymentStatus]}>
                            {PAYMENT_STATUSES[reg.paymentStatus]}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right space-x-2">
                          {reg.paymentStatus !== 'paid' && (
                            <Button variant="ghost" size="sm" onClick={() => handlePayment(reg.id, 'paid')}>
                              Marcar pagado
                            </Button>
                          )}
                          {reg.paymentStatus === 'paid' && (
                            <Button variant="ghost" size="sm" onClick={() => handlePayment(reg.id, 'pending')}>
                              Marcar pendiente
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pairs Tab */}
      {activeTab === 'pairs' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => setPairModalOpen(true)} disabled={availablePlayers.length < 2}>
              Crear pareja
            </Button>
          </div>
          <Card>
            <CardContent className="py-4">
              {pairs.length === 0 ? (
                <EmptyState title="Sin parejas" description="Armá las parejas para este evento" />
              ) : (
                <div className="space-y-2">
                  {pairs.map((pair, idx) => (
                    <div key={pair.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-400 dark:text-gray-500">Pareja {idx + 1}:</span>{' '}
                        <span className="font-medium">{pair.player1Name}</span>
                        <span className="text-gray-400 dark:text-gray-500 mx-2">/</span>
                        <span className="font-medium">{pair.player2Name}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeletePair(pair.id)}>
                        Eliminar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Matches Tab */}
      {activeTab === 'matches' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => { resetMatchForm(); setMatchModalOpen(true); }} disabled={pairs.length < 2}>
              Cargar resultado
            </Button>
          </div>
          <Card>
            <CardContent className="py-4">
              {matches.length === 0 ? (
                <EmptyState title="Sin partidos" description="Cargá los resultados de los partidos" />
              ) : (
                <div className="space-y-3">
                  {matches.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className={`font-medium ${m.winnerId === m.pairAId ? 'text-green-700' : ''}`}>{getPairName(m.pairAId)}</span>
                          <span className="text-sm font-bold">{m.scoreA}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-medium ${m.winnerId === m.pairBId ? 'text-green-700' : ''}`}>{getPairName(m.pairBId)}</span>
                          <span className="text-sm font-bold">{m.scoreB}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openEditMatch(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cancel Registration Dialog */}
      <ConfirmDialog
        open={!!cancelRegId}
        onClose={() => setCancelRegId(null)}
        onConfirm={handleCancelReg}
        title="Dar de baja"
        message="¿Estás seguro de que querés dar de baja a este jugador?"
        confirmLabel="Dar de baja"
        loading={cancelLoading}
      />

      {/* Create Pair Modal */}
      <Modal open={pairModalOpen} onClose={() => setPairModalOpen(false)} title="Crear pareja">
        <div className="space-y-4">
          <Select label="Jugador 1" options={playerOptions} value={pairPlayer1} onChange={e => setPairPlayer1(e.target.value)} />
          <Select label="Jugador 2" options={playerOptions.filter(o => o.value !== pairPlayer1)} value={pairPlayer2} onChange={e => setPairPlayer2(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setPairModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreatePair} loading={pairLoading} disabled={!pairPlayer1 || !pairPlayer2}>Crear</Button>
          </div>
        </div>
      </Modal>

      {/* Create/Edit Match Modal */}
      <Modal open={matchModalOpen} onClose={() => { setMatchModalOpen(false); resetMatchForm(); }} title={editingMatchId ? 'Editar resultado' : 'Cargar resultado'}>
        <div className="space-y-4">
          {!editingMatchId && (
            <>
              <Select label="Pareja A" options={pairOptions} value={matchPairA} onChange={e => setMatchPairA(e.target.value)} />
              <Select label="Pareja B" options={pairOptions.filter(o => o.value !== matchPairA)} value={matchPairB} onChange={e => setMatchPairB(e.target.value)} />
            </>
          )}
          <Input label="Resultado Pareja A" placeholder="Ej: 6-4 6-3" value={matchScoreA} onChange={e => setMatchScoreA(e.target.value)} />
          <Input label="Resultado Pareja B" placeholder="Ej: 4-6 3-6" value={matchScoreB} onChange={e => setMatchScoreB(e.target.value)} />
          <Select label="Ganador" options={winnerOptions} value={matchWinner} onChange={e => setMatchWinner(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setMatchModalOpen(false); resetMatchForm(); }}>Cancelar</Button>
            <Button onClick={handleCreateMatch} loading={matchLoading} disabled={!matchWinner || !matchScoreA || !matchScoreB}>
              {editingMatchId ? 'Guardar' : 'Cargar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
