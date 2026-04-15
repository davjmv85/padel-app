import { useState } from 'react';
import { Pencil, Trash2, MoreVertical, Eraser } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { generateGroupFixture, generateEliminationBracket, calculateGroupStandings, rankNonQualifiedPairs, getQualificationRoutes } from '@/utils/americano';
import { inverseScore, determineWinner } from '@/utils/format';
import { createMatch, updateMatch, deleteMatch, clearMatchResult } from '@/features/matches/services/matchService';
import { updateAmericanoPhase } from '../services/eventService';
import { recalculateRankings } from '@/features/ranking/services/rankingService';
import type { PadelEvent, EventPair, EventGroup, Match, MatchPhase } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  event: PadelEvent;
  pairs: EventPair[];
  groups: EventGroup[];
  matches: Match[];
  onReload: () => Promise<void>;
  appUserId: string;
  isFinished: boolean;
}

export function AmericanoMatchesTab({ event, pairs, groups, matches, onReload, appUserId, isFinished }: Props) {
  const phase = event.americanoPhase || 'setup';
  const config = event.americanoConfig;

  const [busy, setBusy] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultMatchId, setResultMatchId] = useState<string | null>(null);
  const [resultScoreA, setResultScoreA] = useState('');
  const [resultPairAId, setResultPairAId] = useState('');
  const [resultPairBId, setResultPairBId] = useState('');
  const [resultLoading, setResultLoading] = useState(false);
  const [deleteMatchId, setDeleteMatchId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [clearResultMatchId, setClearResultMatchId] = useState<string | null>(null);
  const [clearResultLoading, setClearResultLoading] = useState(false);

  // Phase gating: matches of a past phase become read-only
  const phaseOrder: Record<string, number> = { setup: 0, groups: 1, repechaje: 2, elimination: 3, finished: 4 };
  const isPhaseLocked = (matchPhase: MatchPhase | undefined): boolean => {
    if (isFinished) return true;
    if (!matchPhase) return false;
    const current = phaseOrder[phase] ?? 0;
    const mp = phaseOrder[matchPhase] ?? 0;
    return mp < current;
  };

  const getPairName = (pairId: string | null) => {
    if (!pairId) return 'BYE';
    const p = pairs.find(pr => pr.id === pairId);
    return p ? `${p.player1Name} / ${p.player2Name}` : 'Desconocida';
  };

  const groupMatches = matches.filter(m => m.phase === 'group');
  const repechajeMatches = matches.filter(m => m.phase === 'repechaje');
  const eliminationMatches = matches.filter(m => m.phase === 'elimination');

  const allGroupMatchesHaveResult = groupMatches.length > 0 && groupMatches.every(m => !!m.winnerId);
  const allRepechajeMatchesHaveResult = repechajeMatches.length > 0 && repechajeMatches.every(m => !!m.winnerId);

  const handleGenerateGroupFixture = async () => {
    if (!config) return;
    setBusy(true);
    try {
      const matchesPerPair = config.minMatches;
      let created = 0;
      for (const group of groups) {
        const fixture = generateGroupFixture(group.pairIds, matchesPerPair);
        for (const [pairA, pairB] of fixture) {
          await createMatch(event.id, pairA, pairB, appUserId, undefined, {
            phase: 'group',
            groupNumber: group.groupNumber,
          });
          created++;
        }
      }
      if (phase === 'setup') {
        await updateAmericanoPhase(event.id, 'groups');
      }
      toast.success(`${created} partidos de grupo creados`);
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateRepechaje = async () => {
    if (!config) return;
    setBusy(true);
    try {
      const pairNameMap = new Map(pairs.map(p => [p.id, `${p.player1Name} / ${p.player2Name}`]));
      const ranked = rankNonQualifiedPairs(groups, groupMatches, config.directQualifiers, pairNameMap);

      const byePairs: string[] = [];
      const playPairs: string[] = [];

      if (ranked.length % 2 !== 0) {
        byePairs.push(ranked[0].pairId);
        playPairs.push(...ranked.slice(1).map(s => s.pairId));
      } else {
        playPairs.push(...ranked.map(s => s.pairId));
      }

      const shuffled = [...playPairs].sort(() => Math.random() - 0.5);
      let created = 0;
      for (let i = 0; i + 1 < shuffled.length; i += 2) {
        await createMatch(event.id, shuffled[i], shuffled[i + 1], appUserId, undefined, { phase: 'repechaje' });
        created++;
      }

      await updateAmericanoPhase(event.id, 'repechaje');

      if (byePairs.length > 0) {
        toast.success(`${created} partidos de repechaje. ${getPairName(byePairs[0])} recibe bye (mejor no clasificada).`);
      } else {
        toast.success(`${created} partidos de repechaje creados`);
      }
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateBracket = async () => {
    if (!config) return;
    setBusy(true);
    try {
      const pairNameMap = new Map(pairs.map(p => [p.id, `${p.player1Name} / ${p.player2Name}`]));

      // Direct qualifiers (seeded by group rank)
      const qualified: { pairId: string; seed: number }[] = [];
      let seedCounter = 1;
      for (const group of groups) {
        const gMatches = groupMatches.filter(m => m.groupNumber === group.groupNumber);
        const standings = calculateGroupStandings(group.pairIds, gMatches, pairNameMap);
        for (let i = 0; i < config.directQualifiers && i < standings.length; i++) {
          qualified.push({ pairId: standings[i].pairId, seed: seedCounter++ });
        }
      }

      // Repechaje winners
      for (const m of repechajeMatches) {
        if (m.winnerId) {
          qualified.push({ pairId: m.winnerId, seed: seedCounter++ });
        }
      }

      // Bye recipients from repechaje (odd pool)
      const repechajePairIds = new Set(repechajeMatches.flatMap(m => [m.pairAId, m.pairBId]));
      const allRepechajePairs: string[] = [];
      for (const group of groups) {
        const gMatches = groupMatches.filter(m => m.groupNumber === group.groupNumber);
        const standings = calculateGroupStandings(group.pairIds, gMatches, pairNameMap);
        allRepechajePairs.push(...standings.slice(config.directQualifiers).map(s => s.pairId));
      }
      const byePairs = allRepechajePairs.filter(id => !repechajePairIds.has(id));
      for (const pairId of byePairs) {
        qualified.push({ pairId, seed: seedCounter++ });
      }

      const bracket = generateEliminationBracket(qualified);
      let created = 0;

      for (const slot of bracket) {
        if (slot.pairAId && slot.pairBId) {
          await createMatch(event.id, slot.pairAId, slot.pairBId, appUserId, undefined, {
            phase: 'elimination',
            bracketRound: slot.bracketRound,
            bracketPosition: slot.bracketPosition,
          });
          created++;
        } else if (slot.pairAId || slot.pairBId) {
          // BYE — the non-null pair advances automatically, no match needed
          // We still create a placeholder to show in the bracket
        }
      }

      await updateAmericanoPhase(event.id, 'elimination');
      toast.success(`Cuadro eliminatorio generado: ${created} partidos`);
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleAdvanceEliminationRound = async () => {
    setBusy(true);
    try {
      const currentMaxRound = Math.max(...eliminationMatches.map(m => m.bracketRound || 1));
      const currentRoundMatches = eliminationMatches.filter(m => m.bracketRound === currentMaxRound);
      const winners = currentRoundMatches.filter(m => m.winnerId).map(m => m.winnerId);

      if (winners.length < 2) {
        toast.error('Se necesitan al menos 2 ganadores para la siguiente ronda');
        return;
      }

      let created = 0;
      for (let i = 0; i + 1 < winners.length; i += 2) {
        await createMatch(event.id, winners[i], winners[i + 1], appUserId, undefined, {
          phase: 'elimination',
          bracketRound: currentMaxRound + 1,
          bracketPosition: Math.floor(i / 2) + 1,
        });
        created++;
      }

      if (winners.length === 2) {
        await updateAmericanoPhase(event.id, 'finished');
      }

      toast.success(`${created} partidos de ronda ${currentMaxRound + 1} creados`);
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
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
      toast.error('Resultado inválido. Formato: "6-4" o "6-4 6-3"');
      return;
    }
    setResultLoading(true);
    try {
      const winnerId = winner === 'A' ? resultPairAId : resultPairBId;
      await updateMatch(resultMatchId, resultScoreA, inverseScore(resultScoreA), winnerId);
      await recalculateRankings();
      toast.success('Resultado guardado');
      setResultModalOpen(false);
      setResultMatchId(null);
      setResultScoreA('');
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setResultLoading(false);
    }
  };

  const handleDeleteMatch = async () => {
    if (!deleteMatchId) return;
    setDeleteLoading(true);
    try {
      await deleteMatch(deleteMatchId);
      await recalculateRankings();
      toast.success('Partido eliminado');
      setDeleteMatchId(null);
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleClearResult = async () => {
    if (!clearResultMatchId) return;
    setClearResultLoading(true);
    try {
      await clearMatchResult(clearResultMatchId);
      await recalculateRankings();
      toast.success('Resultado borrado. El partido queda pendiente.');
      setClearResultMatchId(null);
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setClearResultLoading(false);
    }
  };

  const renderMatch = (m: Match) => {
    const hasResult = !!m.winnerId;
    const locked = isPhaseLocked(m.phase);
    return (
      <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className={`font-medium ${m.winnerId === m.pairAId ? 'text-green-700 dark:text-green-400' : ''}`}>
              {getPairName(m.pairAId)}
            </span>
            {m.scoreA && <span className="text-sm font-bold">{m.scoreA}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-medium ${m.winnerId === m.pairBId ? 'text-green-700 dark:text-green-400' : ''}`}>
              {getPairName(m.pairBId)}
            </span>
            {m.scoreB && <span className="text-sm font-bold">{m.scoreB}</span>}
          </div>
        </div>
        <MatchKebab
          hasResult={hasResult}
          locked={locked}
          onLoadResult={() => openLoadResult(m)}
          onClearResult={() => setClearResultMatchId(m.id)}
          onDelete={() => setDeleteMatchId(m.id)}
          disabled={isFinished}
        />
      </div>
    );
  };

  const qualificationRoutes = config && eliminationMatches.length > 0
    ? getQualificationRoutes(groups, groupMatches, repechajeMatches, config.directQualifiers, new Map(pairs.map(p => [p.id, `${p.player1Name} / ${p.player2Name}`])))
    : new Map();

  const getPairNameWithRoute = (pairId: string | null, bracketRound: number) => {
    const name = getPairName(pairId);
    if (bracketRound !== 1 || !pairId) return name;
    const route = qualificationRoutes.get(pairId);
    return route ? `${name} (${route})` : name;
  };

  // Check if current elimination round is complete
  const currentElimRound = eliminationMatches.length > 0
    ? Math.max(...eliminationMatches.map(m => m.bracketRound || 1))
    : 0;
  const currentRoundComplete = currentElimRound > 0 &&
    eliminationMatches.filter(m => m.bracketRound === currentElimRound).every(m => !!m.winnerId);
  const currentRoundMatches = eliminationMatches.filter(m => m.bracketRound === currentElimRound);
  const hasMoreElimRounds = currentRoundMatches.filter(m => m.winnerId).length >= 2;
  const isFinal = currentRoundMatches.length === 1 && currentRoundMatches[0]?.winnerId;

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex flex-wrap gap-3">
        {(phase === 'setup' || phase === 'groups') && groupMatches.length === 0 && groups.length > 0 && (
          <Button onClick={handleGenerateGroupFixture} loading={busy} disabled={isFinished}>
            Generar fixture de grupos
          </Button>
        )}
        {phase === 'groups' && allGroupMatchesHaveResult && repechajeMatches.length === 0 && (
          <Button onClick={handleGenerateRepechaje} loading={busy} disabled={isFinished}>
            Generar repechaje
          </Button>
        )}
        {(phase === 'repechaje') && allRepechajeMatchesHaveResult && eliminationMatches.length === 0 && (
          <Button onClick={handleGenerateBracket} loading={busy} disabled={isFinished}>
            Generar cuadro eliminatorio
          </Button>
        )}
        {phase === 'elimination' && currentRoundComplete && hasMoreElimRounds && !isFinal && (
          <Button onClick={handleAdvanceEliminationRound} loading={busy} disabled={isFinished}>
            Generar siguiente ronda
          </Button>
        )}
      </div>

      {/* Group stage */}
      {groupMatches.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Fase de Grupos
          </h3>
          <div className="space-y-4">
            {groups.map(group => {
              const gm = groupMatches.filter(m => m.groupNumber === group.groupNumber);
              if (gm.length === 0) return null;
              return (
                <Card key={group.id}>
                  <CardContent className="py-4">
                    <h4 className="text-sm font-semibold mb-3">Grupo {String.fromCharCode(64 + group.groupNumber)}</h4>
                    <div className="space-y-2">
                      {gm.map(renderMatch)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Repechaje */}
      {repechajeMatches.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Repechaje
          </h3>
          <Card>
            <CardContent className="py-4">
              <div className="space-y-2">
                {repechajeMatches.map(renderMatch)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Elimination bracket */}
      {eliminationMatches.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Eliminatoria
          </h3>
          <div className="space-y-4">
            {Array.from(new Set(eliminationMatches.map(m => m.bracketRound || 1)))
              .sort((a, b) => a - b)
              .map(round => {
                const roundMatches = eliminationMatches.filter(m => m.bracketRound === round);
                const label = roundMatches.length === 1 ? 'Final' :
                  roundMatches.length === 2 ? 'Semifinal' :
                  roundMatches.length === 4 ? 'Cuartos de final' :
                  `Ronda ${round}`;
                return (
                  <Card key={round}>
                    <CardContent className="py-4">
                      <h4 className="text-sm font-semibold mb-3">{label}</h4>
                      <div className="space-y-2">
                        {roundMatches
                          .sort((a, b) => (a.bracketPosition || 0) - (b.bracketPosition || 0))
                          .map(m => {
                            const hasResult = !!m.winnerId;
                            const locked = isPhaseLocked(m.phase);
                            return (
                              <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg gap-3">
                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex items-center gap-3">
                                    <span className={`font-medium ${m.winnerId === m.pairAId ? 'text-green-700 dark:text-green-400' : ''}`}>
                                      {getPairNameWithRoute(m.pairAId, round)}
                                    </span>
                                    {m.scoreA && <span className="text-sm font-bold">{m.scoreA}</span>}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`font-medium ${m.winnerId === m.pairBId ? 'text-green-700 dark:text-green-400' : ''}`}>
                                      {getPairNameWithRoute(m.pairBId, round)}
                                    </span>
                                    {m.scoreB && <span className="text-sm font-bold">{m.scoreB}</span>}
                                  </div>
                                </div>
                                <MatchKebab
                                  hasResult={hasResult}
                                  locked={locked}
                                  onLoadResult={() => openLoadResult(m)}
                                  onClearResult={() => setClearResultMatchId(m.id)}
                                  onDelete={() => setDeleteMatchId(m.id)}
                                  disabled={isFinished}
                                />
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* Champion */}
      {isFinal && (
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-lg font-bold text-yellow-500">
              Campeón: {getPairName(currentRoundMatches[0].winnerId)}
            </p>
          </CardContent>
        </Card>
      )}

      {matches.length === 0 && (
        <Card>
          <CardContent className="py-4">
            <EmptyState
              title="Sin partidos"
              description={
                phase === 'setup' ? 'Configurá el torneo y avanzá a fase de grupos' :
                phase === 'groups' ? 'Generá el fixture de grupos' :
                'Sin partidos cargados'
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Result Modal */}
      <Modal open={resultModalOpen} onClose={() => setResultModalOpen(false)} title="Cargar resultado">
        <div className="space-y-4">
          <div className="text-sm">
            <div className="font-medium">{getPairName(resultPairAId)}</div>
            <div className="text-gray-400 dark:text-gray-500 text-xs my-1">vs</div>
            <div className="font-medium">{getPairName(resultPairBId)}</div>
          </div>
          <Input
            label="Resultado Pareja A"
            placeholder="Ej: 6-4 o 6-4 6-3"
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
            if (!w) return <p className="text-sm text-red-600 dark:text-red-400">Resultado inválido. Formato: "6-4" o "6-4 6-3"</p>;
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
        message="Se borra el partido completo (incluido su cruce). El ranking se recalculará."
        confirmLabel="Eliminar"
        loading={deleteLoading}
      />

      {/* Clear Result Dialog */}
      <ConfirmDialog
        open={!!clearResultMatchId}
        onClose={() => setClearResultMatchId(null)}
        onConfirm={handleClearResult}
        title="Borrar resultado"
        message="El partido vuelve a estado pendiente. El cruce se mantiene. El ranking se recalculará."
        confirmLabel="Borrar resultado"
        loading={clearResultLoading}
      />
    </div>
  );
}

function MatchKebab({
  hasResult,
  locked,
  onLoadResult,
  onClearResult,
  onDelete,
  disabled,
}: {
  hasResult: boolean;
  locked: boolean;
  onLoadResult: () => void;
  onClearResult: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <MoreVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
          <button
            onClick={() => { onLoadResult(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <Pencil className="h-4 w-4" />
            {hasResult ? 'Editar resultado' : 'Cargar resultado'}
          </button>
          {hasResult && (
            <button
              onClick={() => { onClearResult(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <Eraser className="h-4 w-4" />
              Borrar resultado
            </button>
          )}
          {!hasResult && !locked && (
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Borrar partido
            </button>
          )}
        </div>
      )}
    </div>
  );
}
