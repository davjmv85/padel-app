import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calendar, MapPin, Users, DollarSign, Bell, Trophy, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { getEvent } from '../services/eventService';
import {
  getUserEventRegistration,
  getEventRegistrations,
  registerForEvent,
  cancelRegistration,
  addToWaitlist,
} from '@/features/registrations/services/registrationService';
import { getEventPairs } from '@/features/pairs/services/pairService';
import { getEventMatches } from '@/features/matches/services/matchService';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { EVENT_STATUSES, EVENT_STATUS_COLORS, PLAYER_POSITIONS, TOURNAMENT_TYPES } from '@/utils/constants';
import { formatPrice, countSets } from '@/utils/format';
import type { PadelEvent, Registration, EventPair, Match } from '@/types';

type Tab = 'registrations' | 'pairs' | 'matches' | 'standings';

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { appUser } = useAuth();
  const [event, setEvent] = useState<PadelEvent | null>(null);
  const [myRegistration, setMyRegistration] = useState<Registration | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [pairs, setPairs] = useState<EventPair[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('registrations');

  const loadData = async () => {
    if (!eventId || !appUser) return;
    try {
      const [ev, myReg, regs, prs, mtchs] = await Promise.all([
        getEvent(eventId),
        getUserEventRegistration(eventId, appUser.id),
        getEventRegistrations(eventId),
        getEventPairs(eventId),
        getEventMatches(eventId),
      ]);
      setEvent(ev);
      setMyRegistration(myReg);
      setRegistrations(regs);
      setPairs(prs);
      setMatches(mtchs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  if (loading || !event) return <Spinner />;

  const isRegistered = !!myRegistration;
  const hasPaid = myRegistration?.paymentStatus === 'paid';
  const isFull = event.currentRegistrations >= event.maxCapacity;
  const canRegister = event.status === 'published' && !isRegistered && !isFull;
  const spotsLeft = event.maxCapacity - event.currentRegistrations;

  const handleRegister = async () => {
    if (!appUser || !eventId) return;
    setActionLoading(true);
    try {
      await registerForEvent(eventId, appUser);
      toast.success('¡Te inscribiste exitosamente!');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al inscribirse');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!myRegistration || !eventId) return;
    setActionLoading(true);
    try {
      await cancelRegistration(myRegistration.id, eventId);
      toast.success('Inscripción cancelada');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cancelar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWaitlist = async () => {
    if (!appUser || !eventId) return;
    setActionLoading(true);
    try {
      await addToWaitlist(eventId, appUser.id, appUser.email);
      toast.success('Te avisaremos cuando se libere un lugar');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al agregar a la lista de espera');
    } finally {
      setActionLoading(false);
    }
  };

  const getPairName = (pairId: string) => {
    const p = pairs.find(pr => pr.id === pairId);
    return p ? `${p.player1Name} / ${p.player2Name}` : 'Pareja desconocida';
  };

  const isLibre = event.tournamentType === 'libre';

  // Pair standings (liga)
  const pairStandings = (() => {
    const stats: Record<string, { id: string; name: string; played: number; won: number; lost: number; setsWon: number; setsLost: number; gamesWon: number; gamesLost: number; points: number }> = {};
    pairs.forEach(p => {
      stats[p.id] = { id: p.id, name: `${p.player1Name} / ${p.player2Name}`, played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, points: 0 };
    });
    matches.forEach(m => {
      if (!m.winnerId) return;
      const counts = countSets(m.scoreA);
      if (!counts) return;
      const a = stats[m.pairAId];
      const b = stats[m.pairBId];
      if (!a || !b) return;
      a.played++; b.played++;
      a.setsWon += counts.won; a.setsLost += counts.lost;
      a.gamesWon += counts.gamesWon; a.gamesLost += counts.gamesLost;
      b.setsWon += counts.lost; b.setsLost += counts.won;
      b.gamesWon += counts.gamesLost; b.gamesLost += counts.gamesWon;
      if (m.winnerId === m.pairAId) { a.won++; a.points++; b.lost++; }
      else if (m.winnerId === m.pairBId) { b.won++; b.points++; a.lost++; }
    });
    return Object.values(stats).sort((x, y) => {
      if (y.points !== x.points) return y.points - x.points;
      const setDiff = (y.setsWon - y.setsLost) - (x.setsWon - x.setsLost);
      if (setDiff !== 0) return setDiff;
      return (y.gamesWon - y.gamesLost) - (x.gamesWon - x.gamesLost);
    });
  })();

  // Player standings (libre)
  const playerStandings = (() => {
    const stats: Record<string, { id: string; name: string; played: number; won: number; lost: number; setsWon: number; setsLost: number; gamesWon: number; gamesLost: number; points: number }> = {};
    const pairMap = new Map(pairs.map(p => [p.id, p]));
    const initPlayer = (userId: string, userName: string) => {
      if (!stats[userId]) stats[userId] = { id: userId, name: userName, played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, points: 0 };
      return stats[userId];
    };
    matches.forEach(m => {
      if (!m.winnerId) return;
      const counts = countSets(m.scoreA);
      if (!counts) return;
      const pairA = pairMap.get(m.pairAId);
      const pairB = pairMap.get(m.pairBId);
      if (!pairA || !pairB) return;
      const playersA = [initPlayer(pairA.player1Id, pairA.player1Name), initPlayer(pairA.player2Id, pairA.player2Name)];
      const playersB = [initPlayer(pairB.player1Id, pairB.player1Name), initPlayer(pairB.player2Id, pairB.player2Name)];
      playersA.forEach(p => { p.played++; p.setsWon += counts.won; p.setsLost += counts.lost; p.gamesWon += counts.gamesWon; p.gamesLost += counts.gamesLost; });
      playersB.forEach(p => { p.played++; p.setsWon += counts.lost; p.setsLost += counts.won; p.gamesWon += counts.gamesLost; p.gamesLost += counts.gamesWon; });
      const winners = m.winnerId === m.pairAId ? playersA : playersB;
      const losers = m.winnerId === m.pairAId ? playersB : playersA;
      winners.forEach(p => { p.won++; p.points++; });
      losers.forEach(p => { p.lost++; });
    });
    return Object.values(stats).sort((x, y) => {
      if (y.points !== x.points) return y.points - x.points;
      const setDiff = (y.setsWon - y.setsLost) - (x.setsWon - x.setsLost);
      if (setDiff !== 0) return setDiff;
      return (y.gamesWon - y.gamesLost) - (x.gamesWon - x.gamesLost);
    });
  })();

  const standings = isLibre ? playerStandings : pairStandings;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'registrations', label: `Inscriptos (${registrations.length})` },
    { key: 'pairs', label: `Parejas (${pairs.length})` },
    { key: 'matches', label: `Partidos (${matches.length})` },
    { key: 'standings', label: 'Posiciones' },
  ];

  // Group matches by round for display
  const matchGroups: Record<string, Match[]> = {};
  matches.forEach(m => {
    const key = m.round ? String(m.round) : 'manual';
    if (!matchGroups[key]) matchGroups[key] = [];
    matchGroups[key].push(m);
  });
  const sortedRoundKeys = Object.keys(matchGroups).sort((a, b) => {
    if (a === 'manual') return 1;
    if (b === 'manual') return -1;
    return parseInt(a) - parseInt(b);
  });

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Eventos disponibles
      </Link>
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-xl font-bold">{event.name}</h1>
            <Badge className={EVENT_STATUS_COLORS[event.status]}>
              {EVENT_STATUSES[event.status]}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              {event.date?.toDate ? event.date.toDate().toLocaleDateString('es-AR') : ''} · {event.time}
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              {event.location}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              {TOURNAMENT_TYPES[event.tournamentType || 'liga']}
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              {event.currentRegistrations}/{event.maxCapacity}
              {spotsLeft > 0 && <span className="text-green-600 dark:text-green-400 ml-1">({spotsLeft} disp.)</span>}
              {isFull && <span className="text-red-600 dark:text-red-400 ml-1">(Completo)</span>}
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              {formatPrice(event.price)}
            </span>
          </div>

          {event.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{event.description}</p>
          )}

          <div className="flex gap-3">
            {canRegister && (
              <Button onClick={handleRegister} loading={actionLoading}>
                {/* <img src="/favicon.svg" alt="" className="h-5 w-5 mr-2" /> */}
                Inscribirme
              </Button>
            )}
            {isRegistered && event.status === 'published' && (
              <Button variant="danger" onClick={handleCancel} loading={actionLoading}>
                Cancelar inscripción
              </Button>
            )}
            {isFull && !isRegistered && event.status === 'published' && (
              <Button variant="secondary" onClick={handleWaitlist} loading={actionLoading}>
                <Bell className="h-4 w-4 mr-2" />
                Avisarme cuando haya lugar
              </Button>
            )}
            {isRegistered && (
              <Badge className="bg-green-800 text-green-200 self-center py-1 px-4">😊 Ya estás inscripto</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mensaje si está inscripto pero no pagó */}
      {isRegistered && !hasPaid && (
        <div className="mt-6 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-300">
          Ya estás inscripto, pero todavía figurás como <strong>pago pendiente</strong>. Una vez que el organizador confirme tu pago, vas a poder ver los inscriptos, parejas, partidos y posiciones del torneo.
        </div>
      )}

      {/* Tabs visibles solo si el jugador está inscripto Y pagó */}
      {isRegistered && hasPaid && (
        <div className="mt-6">
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Inscriptos */}
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
                        </tr>
                      </thead>
                      <tbody>
                        {registrations.map(reg => (
                          <tr key={reg.id} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2.5">{reg.userName}{reg.userId === appUser?.id && <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">(vos)</span>}</td>
                            <td className="py-2.5">{PLAYER_POSITIONS[reg.userPosition]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Parejas */}
          {activeTab === 'pairs' && (() => {
            const renderPair = (pair: EventPair, idx: number) => {
              const p1Pos = registrations.find(r => r.userId === pair.player1Id)?.userPosition;
              const p2Pos = registrations.find(r => r.userId === pair.player2Id)?.userPosition;
              const imInPair = pair.player1Id === appUser?.id || pair.player2Id === appUser?.id;
              return (
                <div key={pair.id} className={`p-3 rounded-lg ${imInPair ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-700'}`}>
                  <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{idx + 1}:</span>{' '}
                  <span className="font-medium">{pair.player1Name}</span>
                  {p1Pos && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({PLAYER_POSITIONS[p1Pos]})</span>}
                  <span className="text-gray-400 dark:text-gray-500 mx-2">/</span>
                  <span className="font-medium">{pair.player2Name}</span>
                  {p2Pos && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({PLAYER_POSITIONS[p2Pos]})</span>}
                </div>
              );
            };

            if (pairs.length === 0) {
              return (
                <Card><CardContent className="py-4"><EmptyState title="Sin parejas" description="Todavía no se armaron las parejas" /></CardContent></Card>
              );
            }

            if (isLibre) {
              const roundsSet = new Set(pairs.map(p => p.round).filter((r): r is number => r != null));
              const rounds = Array.from(roundsSet).sort((a, b) => a - b);
              return (
                <div className="space-y-6">
                  {rounds.map(round => {
                    const pairsInRound = pairs.filter(p => p.round === round);
                    return (
                      <div key={round}>
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Fecha {round}</h3>
                        <Card>
                          <CardContent className="py-4">
                            <div className="space-y-2">
                              {pairsInRound.map((pair, idx) => renderPair(pair, idx))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              );
            }

            return (
              <Card>
                <CardContent className="py-4">
                  <div className="space-y-2">
                    {pairs.map((pair, idx) => renderPair(pair, idx))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Partidos */}
          {activeTab === 'matches' && (
            <Card>
              <CardContent className="py-4">
                {matches.length === 0 ? (
                  <EmptyState title="Sin partidos" description="Todavía no se cargaron los partidos" />
                ) : (
                  <div className="space-y-6">
                    {sortedRoundKeys.map(key => (
                      <div key={key}>
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                          {key === 'manual' ? 'Sin fecha' : `Fecha ${key}`}
                        </h3>
                        <div className="space-y-2">
                          {matchGroups[key].map(m => (
                            <div key={m.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-1">
                              <div className="flex items-center gap-3">
                                <span className={`font-medium flex-1 ${m.winnerId === m.pairAId ? 'text-green-700 dark:text-green-400' : ''}`}>{getPairName(m.pairAId)}</span>
                                {m.scoreA && <span className="text-sm font-bold">{m.scoreA}</span>}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`font-medium flex-1 ${m.winnerId === m.pairBId ? 'text-green-700 dark:text-green-400' : ''}`}>{getPairName(m.pairBId)}</span>
                                {m.scoreB && <span className="text-sm font-bold">{m.scoreB}</span>}
                              </div>
                              {!m.winnerId && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">Sin resultado</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Posiciones */}
          {activeTab === 'standings' && (
            <Card>
              <CardContent className="py-4">
                {pairs.length === 0 ? (
                  <EmptyState title="Sin datos" description="Se mostrará cuando haya parejas y partidos" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400 w-10">#</th>
                          <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">{isLibre ? 'Jugador' : 'Pareja'}</th>
                          <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PJ</th>
                          <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PG</th>
                          <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">PP</th>
                          <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">SG</th>
                          <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">SP</th>
                          <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">Set±</th>
                          <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">GG</th>
                          <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">GP</th>
                          <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">Game±</th>
                          <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((s, idx) => {
                          const setDiff = s.setsWon - s.setsLost;
                          const gameDiff = s.gamesWon - s.gamesLost;
                          // Highlight: pair row if admin view, or player row if libre
                          const isMine = isLibre
                            ? s.id === appUser?.id
                            : (() => {
                              const p = pairs.find(pr => pr.id === s.id);
                              return !!(p && (p.player1Id === appUser?.id || p.player2Id === appUser?.id));
                            })();
                          return (
                            <tr key={s.id} className={`border-b border-gray-100 dark:border-gray-700 ${isMine ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                              <td className="py-2.5">
                                <span className={`font-bold ${idx === 0 ? 'text-yellow-500' : idx < 3 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-2.5 font-medium">{s.name}</td>
                              <td className="py-2.5 text-center">{s.played}</td>
                              <td className="py-2.5 text-center">{s.won}</td>
                              <td className="py-2.5 text-center">{s.lost}</td>
                              <td className="py-2.5 text-center">{s.setsWon}</td>
                              <td className="py-2.5 text-center">{s.setsLost}</td>
                              <td className="py-2.5 text-center">{setDiff > 0 ? '+' : ''}{setDiff}</td>
                              <td className="py-2.5 text-center">{s.gamesWon}</td>
                              <td className="py-2.5 text-center">{s.gamesLost}</td>
                              <td className="py-2.5 text-center">{gameDiff > 0 ? '+' : ''}{gameDiff}</td>
                              <td className="py-2.5 text-center font-bold">{s.points}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                      PJ: jugados · PG/PP: partidos ganados/perdidos · SG/SP: sets · GG/GP: games · Pts: puntos
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
