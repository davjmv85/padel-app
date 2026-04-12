import { useEffect, useState, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Pencil, MoreVertical, Check, Clock, UserMinus, Trash2, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getEvent } from '../services/eventService';
import { getEventRegistrations, cancelRegistration, updatePaymentStatus } from '@/features/registrations/services/registrationService';
import { getEventPairs, createPair, deletePair } from '@/features/pairs/services/pairService';
import { getEventMatches, createMatch, updateMatch, deleteMatch } from '@/features/matches/services/matchService';
import { recalculateRankings } from '@/features/ranking/services/rankingService';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { EVENT_STATUSES, EVENT_STATUS_COLORS, PAYMENT_STATUSES, PAYMENT_STATUS_COLORS, PLAYER_POSITIONS, TOURNAMENT_TYPES } from '@/utils/constants';
import { formatPrice, inverseScore, determineWinner, countSets } from '@/utils/format';
import type { PadelEvent, Registration, EventPair, Match } from '@/types';
import toast from 'react-hot-toast';

type Tab = 'registrations' | 'pairs' | 'matches' | 'standings';

export function AdminEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [event, setEvent] = useState<PadelEvent | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [pairs, setPairs] = useState<EventPair[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('registrations');

  // Modal states
  const [cancelRegId, setCancelRegId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [pairModalOpen, setPairModalOpen] = useState(false);
  const [matchModalOpen, setMatchModalOpen] = useState(false);

  // Pair form
  const [pairPlayer1, setPairPlayer1] = useState('');
  const [pairPlayer2, setPairPlayer2] = useState('');
  const [pairLoading, setPairLoading] = useState(false);
  // For 'libre' type: which fecha (round) the modal is creating a pair for
  const [pairFormRound, setPairFormRound] = useState<number | null>(null);
  // For libre: local state for empty draft fechas (not yet in DB)
  const [draftFechas, setDraftFechas] = useState<number[]>([]);

  // Match form (create)
  const [matchPairA, setMatchPairA] = useState('');
  const [matchPairB, setMatchPairB] = useState('');
  const [matchLoading, setMatchLoading] = useState(false);
  // For libre: which fecha (round) the new match belongs to
  const [matchFormRound, setMatchFormRound] = useState<number | null>(null);

  // Match result form (load score)
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultMatchId, setResultMatchId] = useState<string | null>(null);
  const [resultScoreA, setResultScoreA] = useState('');
  const [resultPairAId, setResultPairAId] = useState('');
  const [resultPairBId, setResultPairBId] = useState('');
  const [resultLoading, setResultLoading] = useState(false);

  // Delete match
  const [deleteMatchId, setDeleteMatchId] = useState<string | null>(null);
  const [deleteMatchLoading, setDeleteMatchLoading] = useState(false);

  // Delete all matches / pairs
  const [deleteAllMatchesOpen, setDeleteAllMatchesOpen] = useState(false);
  const [deleteAllMatchesLoading, setDeleteAllMatchesLoading] = useState(false);
  const [deleteAllPairsOpen, setDeleteAllPairsOpen] = useState(false);
  const [deleteAllPairsLoading, setDeleteAllPairsLoading] = useState(false);

  // Tournament builder
  const [tournamentFechas, setTournamentFechas] = useState<string>('');
  const [tournamentBusy, setTournamentBusy] = useState(false);

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
    { key: 'registrations', label: `Inscriptos (${registrations.length})` },
    { key: 'pairs', label: `Parejas (${pairs.length})` },
    { key: 'matches', label: `Partidos (${matches.length})` },
    { key: 'standings', label: 'Posiciones' },
  ];

  const handleCancelReg = async () => {
    if (!cancelRegId || !eventId) return;
    const reg = registrations.find(r => r.id === cancelRegId);
    if (reg) {
      const inPair = pairs.some(p => p.player1Id === reg.userId || p.player2Id === reg.userId);
      if (inPair) {
        toast.error('No se puede dar de baja: el jugador está en una pareja. Eliminala primero.');
        setCancelRegId(null);
        return;
      }
    }
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
      await createPair(eventId, p1.userId, p1.userName, p2.userId, p2.userName, pairFormRound ?? undefined);
      toast.success('Pareja creada');
      setPairModalOpen(false);
      setPairPlayer1('');
      setPairPlayer2('');
      setPairFormRound(null);
      await loadData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al crear pareja'); }
    finally { setPairLoading(false); }
  };

  const handleDeletePair = async (pairId: string) => {
    const usedPairIds = new Set(matches.flatMap(m => [m.pairAId, m.pairBId]));
    if (usedPairIds.has(pairId)) {
      toast.error('No se puede eliminar: la pareja tiene partidos asociados');
      return;
    }
    try {
      await deletePair(pairId);
      toast.success('Pareja eliminada');
      await loadData();
    } catch { toast.error('Error al eliminar pareja'); }
  };

  const handleAutoPair = async (round?: number) => {
    if (!eventId) return;
    // For libre, we auto-pair players NOT yet in a pair of that specific round
    // For liga, we auto-pair players NOT yet in any event pair
    const pool = round != null
      ? registrations.filter(r => {
          const inRound = pairs.some(p => p.round === round && (p.player1Id === r.userId || p.player2Id === r.userId));
          return !inRound;
        })
      : availablePlayers;
    if (pool.length < 2) {
      toast.error('No hay suficientes jugadores disponibles');
      return;
    }
    setPairLoading(true);
    try {
      // In libre mode, avoid repeating pairs from ANY previous fecha
      const pairKey = (a: string, b: string) => [a, b].sort().join('|');
      const forbiddenKeys = new Set(
        round != null ? pairs.map(p => pairKey(p.player1Id, p.player2Id)) : []
      );

      const shuffle = <T,>(arr: T[]) => arr.map(v => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
      const drives = shuffle(pool.filter(p => p.userPosition === 'drive'));
      const reves = shuffle(pool.filter(p => p.userPosition === 'reves'));
      const indistintos = shuffle(pool.filter(p => p.userPosition === 'indistinto'));

      type Player = typeof pool[0];
      const newPairs: [Player, Player][] = [];

      const tryPair = (a: Player, bList: Player[]): Player | null => {
        // Find first player in bList that doesn't form a forbidden pair with a
        const idx = bList.findIndex(b => !forbiddenKeys.has(pairKey(a.userId, b.userId)));
        if (idx === -1) return null;
        const [picked] = bList.splice(idx, 1);
        forbiddenKeys.add(pairKey(a.userId, picked.userId));
        return picked;
      };

      // Step 1: drive + reves (skipping forbidden combos)
      const leftoverDrives: Player[] = [];
      while (drives.length > 0 && reves.length > 0) {
        const d = drives.pop()!;
        const r = tryPair(d, reves);
        if (r) newPairs.push([d, r]);
        else leftoverDrives.push(d);
      }
      // Put leftover drives back so step 2 can pair them with indistintos
      drives.push(...leftoverDrives);

      // Step 2: leftover (drive or reves) + indistinto
      const leftoverMain: Player[] = [];
      while ((drives.length > 0 || reves.length > 0) && indistintos.length > 0) {
        const main = drives.length > 0 ? drives.pop()! : reves.pop()!;
        const i = tryPair(main, indistintos);
        if (i) newPairs.push([main, i]);
        else leftoverMain.push(main);
      }

      // Step 3: indistinto + indistinto
      while (indistintos.length >= 2) {
        const a = indistintos.pop()!;
        const b = tryPair(a, indistintos);
        if (b) newPairs.push([a, b]);
        else leftoverMain.push(a);
      }

      // Step 4: same position (last resort) — also checking forbidden
      const tryPairFromList = (list: Player[]) => {
        while (list.length >= 2) {
          const a = list.pop()!;
          const b = tryPair(a, list);
          if (b) newPairs.push([a, b]);
          else leftoverMain.push(a);
        }
      };
      tryPairFromList(drives);
      tryPairFromList(reves);

      if (newPairs.length === 0) {
        toast.error('No se pudo armar ninguna pareja nueva (todas las combinaciones posibles ya existen en fechas anteriores)');
        return;
      }

      for (const [p1, p2] of newPairs) {
        await createPair(eventId, p1.userId, p1.userName, p2.userId, p2.userName, round);
      }

      const skipped = pool.length - (newPairs.length * 2);
      if (skipped > 0) {
        toast.success(`${newPairs.length} parejas creadas. ${skipped} jugadores quedaron sin pareja (posibles combinaciones agotadas).`);
      } else {
        toast.success(`${newPairs.length} parejas creadas`);
      }
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al armar parejas');
    } finally {
      setPairLoading(false);
    }
  };

  const handleCreateMatch = async () => {
    if (!eventId || !appUser || !matchPairA || !matchPairB) return;
    setMatchLoading(true);
    try {
      await createMatch(eventId, matchPairA, matchPairB, appUser.id, matchFormRound ?? undefined);
      toast.success('Partido creado');
      setMatchModalOpen(false);
      resetMatchForm();
      await loadData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error'); }
    finally { setMatchLoading(false); }
  };

  const handleAutoMatches = async () => {
    if (!eventId || !appUser) return;
    const isLibre = event?.tournamentType === 'libre';
    setMatchLoading(true);
    try {
      const matchKey = (a: string, b: string) => [a, b].sort().join('|');
      const existingKeys = new Set(matches.map(m => matchKey(m.pairAId, m.pairBId)));
      const shuffle = <T,>(arr: T[]) => arr.map(v => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

      const allMatches: { a: string; b: string; round: number }[] = [];
      const generatedKeys = new Set<string>();

      if (isLibre) {
        // For libre: generate all crosses within each fecha (round)
        const rounds = Array.from(new Set(pairs.map(p => p.round).filter((r): r is number => r != null))).sort((a, b) => a - b);
        if (rounds.length === 0) {
          toast.error('No hay fechas con parejas. Creá las parejas de una fecha primero.');
          return;
        }
        for (const round of rounds) {
          const pairsInRound = pairs.filter(p => p.round === round);
          // All crosses
          for (let i = 0; i < pairsInRound.length; i++) {
            for (let j = i + 1; j < pairsInRound.length; j++) {
              const a = pairsInRound[i].id;
              const b = pairsInRound[j].id;
              const key = matchKey(a, b);
              if (!existingKeys.has(key) && !generatedKeys.has(key)) {
                allMatches.push({ a, b, round });
                generatedKeys.add(key);
              }
            }
          }
        }
      } else {
        // Liga: round-robin 3 rounds
        if (pairs.length < 4) {
          toast.error('Se necesitan al menos 4 parejas');
          return;
        }
        if (pairs.length % 2 !== 0) {
          toast.error('Se necesita un número par de parejas para que cada una juegue 3 partidos');
          return;
        }
        const maxExistingRound = matches.reduce((max, m) => (m.round && m.round > max ? m.round : max), 0);
        const ids = shuffle(pairs.map(p => p.id));
        const N = ids.length;
        for (let r = 0; r < 3; r++) {
          for (let i = 0; i < N / 2; i++) {
            const a = ids[i];
            const b = ids[N - 1 - i];
            const key = matchKey(a, b);
            if (!existingKeys.has(key) && !generatedKeys.has(key)) {
              allMatches.push({ a, b, round: maxExistingRound + r + 1 });
              generatedKeys.add(key);
            }
          }
          const last = ids.pop()!;
          ids.splice(1, 0, last);
        }
      }

      if (allMatches.length === 0) {
        toast('No hay nuevos cruces posibles, todos los partidos ya existen');
        return;
      }

      for (const m of allMatches) {
        await createMatch(eventId, m.a, m.b, appUser.id, m.round);
      }
      toast.success(`${allMatches.length} partidos creados`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al armar partidos');
    } finally {
      setMatchLoading(false);
    }
  };

  const handleDeleteAllMatches = async () => {
    if (matches.length === 0) return;
    setDeleteAllMatchesLoading(true);
    try {
      for (const m of matches) {
        await deleteMatch(m.id);
      }
      await recalculateRankings();
      toast.success(`${matches.length} partidos eliminados`);
      setDeleteAllMatchesOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setDeleteAllMatchesLoading(false);
    }
  };

  const handleDeleteAllPairs = async () => {
    if (pairs.length === 0) return;
    setDeleteAllPairsLoading(true);
    try {
      const usedPairIds = new Set(matches.flatMap(m => [m.pairAId, m.pairBId]));
      const deletable = pairs.filter(p => !usedPairIds.has(p.id));
      const skipped = pairs.length - deletable.length;
      for (const p of deletable) {
        await deletePair(p.id);
      }
      if (deletable.length === 0) {
        toast.error('No se pudo eliminar ninguna pareja: todas tienen partidos asociados');
      } else if (skipped > 0) {
        toast.success(`${deletable.length} parejas eliminadas. ${skipped} no se eliminaron porque tienen partidos`);
      } else {
        toast.success(`${deletable.length} parejas eliminadas`);
      }
      setDeleteAllPairsOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setDeleteAllPairsLoading(false);
    }
  };

  const resetMatchForm = () => {
    setMatchPairA('');
    setMatchPairB('');
    setMatchFormRound(null);
  };

  // ============================================================
  // Tournament builder: armar / limpiar / recalcular
  // ============================================================

  const handleArmarTorneo = async (fechasOverride?: string) => {
    if (!eventId || !appUser) return;
    const fechasStr = fechasOverride ?? tournamentFechas;
    const fechas = parseInt(fechasStr);
    if (isNaN(fechas) || fechas < 1) {
      toast.error('Ingresá una cantidad válida de fechas');
      return;
    }

    const players = registrations.filter(r => r.status === 'active');
    if (players.length < 4) {
      toast.error('Se necesitan al menos 4 jugadores inscriptos');
      return;
    }
    if (players.length % 4 !== 0) {
      toast.error(`Se necesita un múltiplo de 4 jugadores (hay ${players.length})`);
      return;
    }

    setTournamentBusy(true);
    try {
      const isLibreType = event?.tournamentType === 'libre';
      const shuffleArr = <T,>(arr: T[]): T[] => arr.map(v => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
      const pKey = (a: string, b: string) => [a, b].sort().join('|');
      type Player = typeof players[0];

      // Helper: build pairs from a player pool, avoiding forbidden combos
      const buildPairs = (pool: Player[], forbidden: Set<string>): [Player, Player][] => {
        const drives = shuffleArr(pool.filter(p => p.userPosition === 'drive'));
        const reves = shuffleArr(pool.filter(p => p.userPosition === 'reves'));
        const indistintos = shuffleArr(pool.filter(p => p.userPosition === 'indistinto'));
        const result: [Player, Player][] = [];

        const tryPick = (a: Player, list: Player[]): Player | null => {
          const idx = list.findIndex(b => !forbidden.has(pKey(a.userId, b.userId)));
          if (idx === -1) return null;
          const [picked] = list.splice(idx, 1);
          forbidden.add(pKey(a.userId, picked.userId));
          return picked;
        };

        const leftoverDrives: Player[] = [];
        while (drives.length > 0 && reves.length > 0) {
          const d = drives.pop()!;
          const r = tryPick(d, reves);
          if (r) result.push([d, r]);
          else leftoverDrives.push(d);
        }
        drives.push(...leftoverDrives);
        while ((drives.length > 0 || reves.length > 0) && indistintos.length > 0) {
          const main = drives.length > 0 ? drives.pop()! : reves.pop()!;
          const i = tryPick(main, indistintos);
          if (i) result.push([main, i]);
        }
        while (indistintos.length >= 2) {
          const a = indistintos.pop()!;
          const b = tryPick(a, indistintos);
          if (b) result.push([a, b]);
        }
        while (drives.length >= 2) {
          const a = drives.pop()!;
          const b = tryPick(a, drives);
          if (b) result.push([a, b]);
        }
        while (reves.length >= 2) {
          const a = reves.pop()!;
          const b = tryPick(a, reves);
          if (b) result.push([a, b]);
        }
        return result;
      };

      if (isLibreType) {
        // Libre: pre-compute all fechas in memory with retries, then write to Firestore.
        // The greedy algorithm can fail to find a valid arrangement on certain shuffles
        // even when one exists, so we retry up to MAX_ATTEMPTS times with fresh randomization.
        const MAX_ATTEMPTS = 200;
        let plan: { pairs: [Player, Player][] }[] | null = null;

        for (let attempt = 0; attempt < MAX_ATTEMPTS && !plan; attempt++) {
          const allPairKeys = new Set<string>();
          const fechasPlan: { pairs: [Player, Player][] }[] = [];
          let ok = true;

          for (let f = 1; f <= fechas; f++) {
            const fechaPairs = buildPairs([...players], allPairKeys);
            if (fechaPairs.length * 2 < players.length) {
              ok = false;
              break;
            }
            fechasPlan.push({ pairs: fechaPairs });
            // forbidden set was already mutated by buildPairs
          }

          if (ok) plan = fechasPlan;
        }

        if (!plan) {
          throw new Error(`No se pudo armar el torneo con ${fechas} fechas (probé ${MAX_ATTEMPTS} configuraciones). Probá con menos fechas.`);
        }

        // Now persist the plan
        for (let f = 0; f < plan.length; f++) {
          const round = f + 1;
          const createdIds: string[] = [];
          for (const [p1, p2] of plan[f].pairs) {
            const id = await createPair(eventId, p1.userId, p1.userName, p2.userId, p2.userName, round);
            createdIds.push(id);
          }
          // Generate matches inside the fecha (random pairings of pairs)
          const shuffledPairs = shuffleArr(createdIds);
          for (let i = 0; i + 1 < shuffledPairs.length; i += 2) {
            await createMatch(eventId, shuffledPairs[i], shuffledPairs[i + 1], appUser.id, round);
          }
        }
      } else {
        // Liga: build pairs once, then round-robin across fechas
        const allPairs = buildPairs([...players], new Set());
        const numPairs = allPairs.length;
        if (numPairs * 2 < players.length) {
          throw new Error('No se pudieron armar todas las parejas');
        }
        if (fechas > numPairs - 1) {
          throw new Error(`Con ${numPairs} parejas, máximo ${numPairs - 1} fechas (cada pareja juega contra cada otra como mucho una vez).`);
        }

        // Save pairs (no round in liga)
        const pairIds: string[] = [];
        for (const [p1, p2] of allPairs) {
          const id = await createPair(eventId, p1.userId, p1.userName, p2.userId, p2.userName);
          pairIds.push(id);
        }

        // Round-robin rotation
        const ids = shuffleArr([...pairIds]);
        const N = ids.length;
        const mKey = (a: string, b: string) => [a, b].sort().join('|');
        const generatedKeys = new Set<string>();
        const matchesToCreate: { a: string; b: string; round: number }[] = [];

        for (let r = 0; r < fechas; r++) {
          for (let i = 0; i < N / 2; i++) {
            const a = ids[i];
            const b = ids[N - 1 - i];
            const key = mKey(a, b);
            if (!generatedKeys.has(key)) {
              matchesToCreate.push({ a, b, round: r + 1 });
              generatedKeys.add(key);
            }
          }
          const last = ids.pop()!;
          ids.splice(1, 0, last);
        }

        for (const m of matchesToCreate) {
          await createMatch(eventId, m.a, m.b, appUser.id, m.round);
        }
      }

      toast.success('Torneo armado');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al armar torneo');
    } finally {
      setTournamentBusy(false);
    }
  };

  const handleLimpiarTorneo = async (resetInput = true) => {
    if (!eventId) return;
    setTournamentBusy(true);
    try {
      // Delete matches first (they reference pairs)
      for (const m of matches) {
        await deleteMatch(m.id);
      }
      // Then delete pairs
      for (const p of pairs) {
        await deletePair(p.id);
      }
      await recalculateRankings();
      if (resetInput) setTournamentFechas('');
      toast.success('Torneo limpiado');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al limpiar');
    } finally {
      setTournamentBusy(false);
    }
  };

  const handleRecalcularTorneo = async () => {
    const f = tournamentFechas;
    await handleLimpiarTorneo(false);
    await handleArmarTorneo(f);
  };

  const openLoadResult = (m: Match) => {
    setResultMatchId(m.id);
    setResultPairAId(m.pairAId);
    setResultPairBId(m.pairBId);
    setResultScoreA(m.scoreA || '');
    setResultModalOpen(true);
  };

  const handleSaveResult = async () => {
    if (!resultMatchId || !resultScoreA.trim()) return;
    const winner = determineWinner(resultScoreA);
    if (!winner) {
      toast.error('Resultado inválido. Formato: "6-4 6-3"');
      return;
    }
    setResultLoading(true);
    try {
      const winnerId = winner === 'A' ? resultPairAId : resultPairBId;
      await updateMatch(resultMatchId, resultScoreA, inverseScore(resultScoreA), winnerId);
      await recalculateRankings();
      toast.success('Resultado guardado y ranking actualizado');
      setResultModalOpen(false);
      setResultMatchId(null);
      setResultScoreA('');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setResultLoading(false);
    }
  };

  const handleDeleteMatch = async () => {
    if (!deleteMatchId) return;
    setDeleteMatchLoading(true);
    try {
      await deleteMatch(deleteMatchId);
      await recalculateRankings();
      toast.success('Partido eliminado');
      setDeleteMatchId(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setDeleteMatchLoading(false);
    }
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
      playersA.forEach(p => {
        p.played++;
        p.setsWon += counts.won; p.setsLost += counts.lost;
        p.gamesWon += counts.gamesWon; p.gamesLost += counts.gamesLost;
      });
      playersB.forEach(p => {
        p.played++;
        p.setsWon += counts.lost; p.setsLost += counts.won;
        p.gamesWon += counts.gamesLost; p.gamesLost += counts.gamesWon;
      });
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

  const getPairName = (pairId: string) => {
    const p = pairs.find(pr => pr.id === pairId);
    return p ? `${p.player1Name} / ${p.player2Name}` : 'Pareja desconocida';
  };

  // Available players depends on mode and current fecha context
  // - Liga: players not in any pair
  // - Libre (with pairFormRound set): players not in any pair of that round
  // - Libre (no round context): players in general (shown as list for overview)
  const relevantPairs = isLibre && pairFormRound != null
    ? pairs.filter(p => p.round === pairFormRound)
    : isLibre
      ? [] // When opening the modal context-less we don't filter
      : pairs;
  const usedPlayerIds = new Set(relevantPairs.flatMap(p => [p.player1Id, p.player2Id]));
  const availablePlayers = registrations.filter(r => !usedPlayerIds.has(r.userId));

  const playerOptions = [
    { value: '', label: 'Seleccionar jugador' },
    ...availablePlayers.map(r => ({ value: r.userId, label: `${r.userName} (${PLAYER_POSITIONS[r.userPosition]})` })),
  ];

  // For libre with a selected fecha, only show pairs from that fecha
  const pairsForMatchModal = isLibre && matchFormRound != null
    ? pairs.filter(p => p.round === matchFormRound)
    : pairs;
  const pairOptions = [
    { value: '', label: 'Seleccionar pareja' },
    ...pairsForMatchModal.map(p => ({ value: p.id, label: `${p.player1Name} / ${p.player2Name}` })),
  ];

  const isFinished = event.status === 'finished';

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/admin/events" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Gestión de eventos
      </Link>
      {isFinished && (
        <div className="mb-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-300">
          Este evento está <strong>finalizado</strong>. Para modificar inscriptos, parejas o resultados, primero cambiá el estado desde Editar.
        </div>
      )}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">{event.name}</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {event.date?.toDate ? event.date.toDate().toLocaleDateString('es-AR') : ''} - {event.time} | {event.location}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span><span className="text-gray-400 dark:text-gray-500">Tipo:</span> <span className="font-medium text-gray-700 dark:text-gray-300">{TOURNAMENT_TYPES[event.tournamentType || 'liga']}</span></span>
            <span><span className="text-gray-400 dark:text-gray-500">Cupo:</span> <span className="font-medium text-gray-700 dark:text-gray-300">{event.currentRegistrations}/{event.maxCapacity}</span></span>
            <span><span className="text-gray-400 dark:text-gray-500">Precio:</span> <span className="font-medium text-gray-700 dark:text-gray-300">${formatPrice(event.price)}</span></span>
            <span><span className="text-gray-400 dark:text-gray-500">Organizador:</span> <span className="font-medium text-gray-700 dark:text-gray-300">{event.createdByName || event.createdByEmail || event.createdBy}</span></span>
          </div>
          {event.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{event.description}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge className={EVENT_STATUS_COLORS[event.status]}>{EVENT_STATUSES[event.status]}</Badge>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/admin/events/${eventId}/edit`)}>
            <Pencil className="h-4 w-4 " />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Registrations Tab (unified with payments) */}
      {activeTab === 'registrations' && (
        <Card>
          <CardContent className="py-4">
            {registrations.length === 0 ? (
              <EmptyState title="Sin inscriptos" description="Todavía no hay jugadores inscriptos en este evento" />
            ) : (
              <div className="">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Jugador</th>
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Posición</th>
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Pago</th>
                      <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400 w-10"></th>
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
                          <RegistrationKebab
                            paymentStatus={reg.paymentStatus}
                            onTogglePayment={() => handlePayment(reg.id, reg.paymentStatus === 'paid' ? 'pending' : 'paid')}
                            onUnregister={() => setCancelRegId(reg.id)}
                            disabled={isFinished}
                          />
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
      {/* Tournament builder (shared between liga and libre) */}
      {activeTab === 'pairs' && (
        <Card className="mb-4">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad de fechas</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={tournamentFechas}
                  onChange={(e) => setTournamentFechas(e.target.value)}
                  disabled={isFinished || tournamentBusy || (pairs.length > 0 || matches.length > 0)}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Ej: 3"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {pairs.length === 0 && matches.length === 0 ? (
                  <Button onClick={() => handleArmarTorneo()} loading={tournamentBusy} disabled={isFinished || !tournamentFechas}>
                    Armar torneo
                  </Button>
                ) : (
                  <>
                    <Button variant="secondary" onClick={handleRecalcularTorneo} loading={tournamentBusy} disabled={isFinished || !tournamentFechas}>
                      Recalcular
                    </Button>
                    <Button variant="danger" onClick={() => handleLimpiarTorneo()} loading={tournamentBusy} disabled={isFinished}>
                      Limpiar
                    </Button>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {event?.tournamentType === 'libre'
                ? 'Genera parejas distintas en cada fecha y arma los partidos automáticamente.'
                : 'Genera parejas fijas y distribuye los partidos en las fechas (round-robin sin repetir rivales).'}
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'pairs' && !isLibre && (
        <div>
          <div className="flex justify-end gap-2 mb-4 flex-wrap">
            <Button variant="secondary" onClick={() => setDeleteAllPairsOpen(true)} disabled={pairs.length === 0 || isFinished}>
              Borrar todas
            </Button>
            <Button variant="secondary" onClick={() => handleAutoPair()} loading={pairLoading} disabled={availablePlayers.length < 2 || isFinished}>
              Auto-armar parejas
            </Button>
            <Button onClick={() => { setPairFormRound(null); setPairModalOpen(true); }} disabled={availablePlayers.length < 2 || isFinished}>
              Crear pareja
            </Button>
          </div>
          <Card>
            <CardContent className="py-4">
              {pairs.length === 0 ? (
                <EmptyState title="Sin parejas" description="Armá las parejas para este evento" />
              ) : (
                <div className="space-y-2">
                  {pairs.map((pair, idx) => {
                    const p1Pos = registrations.find(r => r.userId === pair.player1Id)?.userPosition;
                    const p2Pos = registrations.find(r => r.userId === pair.player2Id)?.userPosition;
                    return (
                      <div key={pair.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div>
                          <span className="text-sm font-medium text-gray-400 dark:text-gray-500">Pareja {idx + 1}:</span>{' '}
                          <span className="font-medium">{pair.player1Name}</span>
                          {p1Pos && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({PLAYER_POSITIONS[p1Pos]})</span>}
                          <span className="text-gray-400 dark:text-gray-500 mx-2">/</span>
                          <span className="font-medium">{pair.player2Name}</span>
                          {p2Pos && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({PLAYER_POSITIONS[p2Pos]})</span>}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePair(pair.id)} disabled={isFinished}>
                          Eliminar
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pairs Tab - Libre (grouped by fecha) */}
      {activeTab === 'pairs' && isLibre && (() => {
        const dbRounds = Array.from(new Set(pairs.map(p => p.round).filter((r): r is number => r != null)));
        // Union of rounds in DB and locally-drafted empty fechas
        const allRounds = Array.from(new Set([...dbRounds, ...draftFechas])).sort((a, b) => a - b);
        const maxRound = allRounds.length > 0 ? Math.max(...allRounds) : 0;
        const handleNewFecha = () => {
          setDraftFechas(prev => [...prev, maxRound + 1]);
        };
        return (
          <div>
            <div className="flex justify-end gap-2 mb-4 flex-wrap">
              <Button variant="secondary" onClick={() => setDeleteAllPairsOpen(true)} disabled={pairs.length === 0 || isFinished}>
                Borrar todas
              </Button>
              <Button onClick={handleNewFecha} disabled={isFinished}>
                + Nueva fecha
              </Button>
            </div>
            {allRounds.length === 0 ? (
              <Card><CardContent className="py-4"><EmptyState title="Sin fechas" description='Apretá "+ Nueva fecha" para empezar' /></CardContent></Card>
            ) : (
              <div className="space-y-6">
                {allRounds.map(round => {
                  const pairsInRound = pairs.filter(p => p.round === round);
                  const playersInRound = new Set(pairsInRound.flatMap(p => [p.player1Id, p.player2Id]));
                  const canAddMore = registrations.filter(r => !playersInRound.has(r.userId)).length >= 2;
                  const isDraft = dbRounds.indexOf(round) === -1;
                  return (
                    <div key={round}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Fecha {round}
                          {isDraft && <span className="ml-2 text-xs normal-case text-yellow-600 dark:text-yellow-400">(sin parejas)</span>}
                        </h3>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleAutoPair(round)} loading={pairLoading} disabled={!canAddMore || isFinished}>
                            Auto-armar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setPairFormRound(round); setPairModalOpen(true); }} disabled={!canAddMore || isFinished}>
                            + Pareja
                          </Button>
                        </div>
                      </div>
                      <Card>
                        <CardContent className="py-4">
                          {pairsInRound.length === 0 ? (
                            <EmptyState title="Sin parejas" description="Agregá parejas a esta fecha" />
                          ) : (
                            <div className="space-y-2">
                              {pairsInRound.map((pair, idx) => {
                                const p1Pos = registrations.find(r => r.userId === pair.player1Id)?.userPosition;
                                const p2Pos = registrations.find(r => r.userId === pair.player2Id)?.userPosition;
                                return (
                                  <div key={pair.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div>
                                      <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{idx + 1}:</span>{' '}
                                      <span className="font-medium">{pair.player1Name}</span>
                                      {p1Pos && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({PLAYER_POSITIONS[p1Pos]})</span>}
                                      <span className="text-gray-400 dark:text-gray-500 mx-2">/</span>
                                      <span className="font-medium">{pair.player2Name}</span>
                                      {p2Pos && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({PLAYER_POSITIONS[p2Pos]})</span>}
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => handleDeletePair(pair.id)} disabled={isFinished}>
                                      Eliminar
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Matches Tab - Liga */}
      {activeTab === 'matches' && !isLibre && (
        <div>
          <div className="flex justify-end gap-2 mb-4 flex-wrap">
            <Button variant="secondary" onClick={() => setDeleteAllMatchesOpen(true)} disabled={matches.length === 0 || isFinished}>
              Borrar todos
            </Button>
            <Button variant="secondary" onClick={handleAutoMatches} loading={matchLoading} disabled={pairs.length < 4 || isFinished}>
              Auto-armar partidos
            </Button>
            <Button onClick={() => { resetMatchForm(); setMatchModalOpen(true); }} disabled={pairs.length < 2 || isFinished}>
              Cargar partido
            </Button>
          </div>
          <Card>
            <CardContent className="py-4">
              {matches.length === 0 ? (
                <EmptyState title="Sin partidos" description="Cargá los partidos del evento" />
              ) : (
                <div className="space-y-6">
                  {(() => {
                    const groups: Record<string, Match[]> = {};
                    matches.forEach(m => {
                      const key = m.round ? String(m.round) : 'manual';
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(m);
                    });
                    const sortedKeys = Object.keys(groups).sort((a, b) => {
                      if (a === 'manual') return 1;
                      if (b === 'manual') return -1;
                      return parseInt(a) - parseInt(b);
                    });
                    return sortedKeys.map(key => (
                      <div key={key}>
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                          {key === 'manual' ? 'Sin fecha' : `Fecha ${key}`}
                        </h3>
                        <div className="space-y-2">
                          {groups[key].map(m => {
                            const hasResult = !!m.winnerId;
                            return (
                              <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg gap-3">
                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex items-center gap-3">
                                    <span className={`font-medium ${m.winnerId === m.pairAId ? 'text-green-700 dark:text-green-400' : ''}`}>{getPairName(m.pairAId)}</span>
                                    {m.scoreA && <span className="text-sm font-bold">{m.scoreA}</span>}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`font-medium ${m.winnerId === m.pairBId ? 'text-green-700 dark:text-green-400' : ''}`}>{getPairName(m.pairBId)}</span>
                                    {m.scoreB && <span className="text-sm font-bold">{m.scoreB}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <MatchKebab
                                    hasResult={hasResult}
                                    onLoadResult={() => openLoadResult(m)}
                                    onDelete={() => setDeleteMatchId(m.id)}
                                    disabled={isFinished}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Matches Tab - Libre (grouped by fecha, one section per fecha with pairs) */}
      {activeTab === 'matches' && isLibre && (() => {
        // Only show fechas that have pairs
        const dbRounds = Array.from(new Set(pairs.map(p => p.round).filter((r): r is number => r != null))).sort((a, b) => a - b);
        return (
          <div>
            <div className="flex justify-end gap-2 mb-4 flex-wrap">
              <Button variant="secondary" onClick={() => setDeleteAllMatchesOpen(true)} disabled={matches.length === 0 || isFinished}>
                Borrar todos
              </Button>
              <Button variant="secondary" onClick={handleAutoMatches} loading={matchLoading} disabled={dbRounds.length === 0 || isFinished}>
                Auto-armar partidos
              </Button>
            </div>
            {dbRounds.length === 0 ? (
              <Card><CardContent className="py-4"><EmptyState title="Sin fechas" description="Primero armá parejas en la pestaña Parejas" /></CardContent></Card>
            ) : (
              <div className="space-y-6">
                {dbRounds.map(round => {
                  const pairsInRound = pairs.filter(p => p.round === round);
                  const matchesInRound = matches.filter(m => m.round === round);
                  const canCreate = pairsInRound.length >= 2;
                  return (
                    <div key={round}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fecha {round}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { resetMatchForm(); setMatchFormRound(round); setMatchModalOpen(true); }}
                          disabled={!canCreate || isFinished}
                        >
                          + Partido
                        </Button>
                      </div>
                      <Card>
                        <CardContent className="py-4">
                          {matchesInRound.length === 0 ? (
                            <EmptyState title="Sin partidos" description="Cargá los partidos de esta fecha" />
                          ) : (
                            <div className="space-y-2">
                              {matchesInRound.map(m => {
                                const hasResult = !!m.winnerId;
                                return (
                                  <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg gap-3">
                                    <div className="space-y-1 flex-1 min-w-0">
                                      <div className="flex items-center gap-3">
                                        <span className={`font-medium ${m.winnerId === m.pairAId ? 'text-green-700 dark:text-green-400' : ''}`}>{getPairName(m.pairAId)}</span>
                                        {m.scoreA && <span className="text-sm font-bold">{m.scoreA}</span>}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className={`font-medium ${m.winnerId === m.pairBId ? 'text-green-700 dark:text-green-400' : ''}`}>{getPairName(m.pairBId)}</span>
                                        {m.scoreB && <span className="text-sm font-bold">{m.scoreB}</span>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <MatchKebab
                                        hasResult={hasResult}
                                        onLoadResult={() => openLoadResult(m)}
                                        onDelete={() => setDeleteMatchId(m.id)}
                                        disabled={isFinished}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Standings Tab */}
      {activeTab === 'standings' && (
        <Card>
          <CardContent className="py-4">
            {pairs.length === 0 ? (
              <EmptyState title="Sin parejas" description="Armá las parejas y cargá los resultados para ver la tabla" />
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
                      return (
                        <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700">
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
      <Modal open={pairModalOpen} onClose={() => { setPairModalOpen(false); setPairFormRound(null); }} title={isLibre && pairFormRound ? `Agregar pareja a Fecha ${pairFormRound}` : 'Crear pareja'}>
        <div className="space-y-4">
          <Select label="Jugador 1" options={playerOptions} value={pairPlayer1} onChange={e => setPairPlayer1(e.target.value)} />
          <Select label="Jugador 2" options={playerOptions.filter(o => o.value !== pairPlayer1)} value={pairPlayer2} onChange={e => setPairPlayer2(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setPairModalOpen(false); setPairFormRound(null); }}>Cancelar</Button>
            <Button onClick={handleCreatePair} loading={pairLoading} disabled={!pairPlayer1 || !pairPlayer2}>Crear</Button>
          </div>
        </div>
      </Modal>

      {/* Create Match Modal (only pairs) */}
      <Modal open={matchModalOpen} onClose={() => { setMatchModalOpen(false); resetMatchForm(); }} title={isLibre && matchFormRound ? `Cargar partido - Fecha ${matchFormRound}` : 'Cargar partido'}>
        <div className="space-y-4">
          <Select label="Pareja A" options={pairOptions} value={matchPairA} onChange={e => setMatchPairA(e.target.value)} />
          <Select label="Pareja B" options={pairOptions.filter(o => o.value !== matchPairA)} value={matchPairB} onChange={e => setMatchPairB(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setMatchModalOpen(false); resetMatchForm(); }}>Cancelar</Button>
            <Button onClick={handleCreateMatch} loading={matchLoading} disabled={!matchPairA || !matchPairB}>
              Crear partido
            </Button>
          </div>
        </div>
      </Modal>

      {/* Load Result Modal */}
      <Modal open={resultModalOpen} onClose={() => setResultModalOpen(false)} title="Cargar resultado">
        <div className="space-y-4">
          <div className="text-sm">
            <div className="font-medium">{getPairName(resultPairAId)}</div>
            <div className="text-gray-400 dark:text-gray-500 text-xs my-1">vs</div>
            <div className="font-medium">{getPairName(resultPairBId)}</div>
          </div>
          <Input
            label="Resultado Pareja A"
            placeholder="Ej: 6-4 6-3"
            value={resultScoreA}
            onChange={e => setResultScoreA(e.target.value)}
          />
          <Input
            label="Resultado Pareja B (calculado)"
            value={inverseScore(resultScoreA)}
            readOnly
            className="bg-gray-50 dark:bg-gray-900 cursor-not-allowed"
          />
          {resultScoreA && (() => {
            const w = determineWinner(resultScoreA);
            if (!w) return <p className="text-sm text-red-600 dark:text-red-400">Resultado inválido. Formato: "6-4 6-3"</p>;
            return (
              <p className="text-sm text-green-700 dark:text-green-400">
                Ganador: <strong>{getPairName(w === 'A' ? resultPairAId : resultPairBId)}</strong>
              </p>
            );
          })()}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setResultModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveResult} loading={resultLoading} disabled={!resultScoreA || !determineWinner(resultScoreA)}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Match Dialog */}
      <ConfirmDialog
        open={!!deleteMatchId}
        onClose={() => setDeleteMatchId(null)}
        onConfirm={handleDeleteMatch}
        title="Eliminar partido"
        message="¿Estás seguro de que querés eliminar este partido? El ranking se recalculará."
        confirmLabel="Eliminar"
        loading={deleteMatchLoading}
      />

      {/* Delete All Matches Dialog */}
      <ConfirmDialog
        open={deleteAllMatchesOpen}
        onClose={() => setDeleteAllMatchesOpen(false)}
        onConfirm={handleDeleteAllMatches}
        title="Borrar todos los partidos"
        message={`¿Estás seguro de que querés eliminar los ${matches.length} partidos del evento? El ranking se recalculará.`}
        confirmLabel="Borrar todos"
        loading={deleteAllMatchesLoading}
      />

      {/* Delete All Pairs Dialog */}
      <ConfirmDialog
        open={deleteAllPairsOpen}
        onClose={() => setDeleteAllPairsOpen(false)}
        onConfirm={handleDeleteAllPairs}
        title="Borrar todas las parejas"
        message="¿Estás seguro de que querés eliminar todas las parejas? Las parejas que tengan partidos asociados no se eliminarán."
        confirmLabel="Borrar todas"
        loading={deleteAllPairsLoading}
      />
    </div>
  );
}

function RegistrationKebab({
  paymentStatus,
  onTogglePayment,
  onUnregister,
  disabled,
}: {
  paymentStatus: 'pending' | 'paid' | 'cancelled';
  onTogglePayment: () => void;
  onUnregister: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <MoreVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
          <button
            onClick={() => { onTogglePayment(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            {paymentStatus === 'paid' ? <Clock className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {paymentStatus === 'paid' ? 'Marcar pendiente' : 'Marcar pagado'}
          </button>
          <button
            onClick={() => { onUnregister(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <UserMinus className="h-4 w-4" />
            Dar de baja
          </button>
        </div>
      )}
    </div>
  );
}

function MatchKebab({
  hasResult,
  onLoadResult,
  onDelete,
  disabled,
}: {
  hasResult: boolean;
  onLoadResult: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <MoreVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
          <button
            onClick={() => { onLoadResult(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <Pencil className="h-4 w-4" />
            {hasResult ? 'Editar resultado' : 'Cargar resultado'}
          </button>
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            Borrar partido
          </button>
        </div>
      )}
    </div>
  );
}
