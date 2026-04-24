import { useState } from 'react';
import { Pencil, Trash2, MoreVertical, Eraser } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { generateGroupRound1, generateGroupRound2, generateOctavos, planNextEliminationRound } from '@/utils/americano';
import { inverseScore, determineWinner } from '@/utils/format';
import { primeKeyboard } from '@/utils/iosKeyboardPrimer';
import { createMatch, updateMatch, deleteMatch, clearMatchResult } from '@/features/matches/services/matchService';
import { updateAmericanoPhase } from '../services/eventService';
import { recalculateRankings } from '@/features/ranking/services/rankingService';
import type { PadelEvent, EventPair, EventGroup, Match } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  event: PadelEvent;
  pairs: EventPair[];
  groups: EventGroup[];
  matches: Match[];
  onReload: () => Promise<void>;
  appUserId: string;
  isFinished: boolean;
  readOnly?: boolean;
}

export function AmericanoMatchesTab({ event, pairs, groups, matches, onReload, appUserId, isFinished, readOnly = false }: Props) {
  const phase = event.americanoPhase || 'setup';

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

  const getPairName = (pairId: string | null) => {
    if (!pairId) return 'BYE';
    const p = pairs.find(pr => pr.id === pairId);
    return p ? `${p.player1Name} / ${p.player2Name}` : 'Desconocida';
  };

  const pairNameMap = new Map(pairs.map(p => [p.id, `${p.player1Name} / ${p.player2Name}`]));

  const groupMatches = matches.filter(m => m.phase === 'group');
  const round1Matches = groupMatches.filter(m => m.round === 1);
  const round2Matches = groupMatches.filter(m => m.round === 2);
  const eliminationMatches = matches.filter(m => m.phase === 'elimination');

  const allRound1HaveResult = round1Matches.length > 0 && round1Matches.every(m => !!m.winnerId);
  const allRound2HaveResult = round2Matches.length > 0 && round2Matches.every(m => !!m.winnerId);

  const isGroupPhaseLocked = phase !== 'groups' && phase !== 'setup';

  // --- Handlers ---

  const handleGenerateRound1 = async () => {
    setBusy(true);
    try {
      let created = 0;
      for (const group of groups) {
        const fixture = generateGroupRound1(group.pairIds);
        for (const [pairA, pairB] of fixture) {
          await createMatch(event.id, pairA, pairB, appUserId, 1, {
            phase: 'group',
            groupNumber: group.groupNumber,
          });
          created++;
        }
      }
      if (phase === 'setup') {
        await updateAmericanoPhase(event.id, 'groups');
      }
      toast.success(`${created} partidos de Ronda 1 creados`);
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateRound2 = async () => {
    setBusy(true);
    try {
      let created = 0;
      for (const group of groups) {
        const gRound1 = round1Matches.filter(m => m.groupNumber === group.groupNumber);
        const fixture = generateGroupRound2(gRound1);
        if (!fixture) {
          toast.error(`Grupo ${String.fromCharCode(64 + group.groupNumber)}: Ronda 1 sin resultados completos`);
          continue;
        }
        for (const [pairA, pairB] of fixture) {
          await createMatch(event.id, pairA, pairB, appUserId, 2, {
            phase: 'group',
            groupNumber: group.groupNumber,
          });
          created++;
        }
      }
      toast.success(`${created} partidos de Ronda 2 creados`);
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateOctavos = async () => {
    setBusy(true);
    try {
      const slots = generateOctavos(groups, groupMatches, pairNameMap);
      if (slots.length === 0) {
        toast.error('No se pudieron generar los octavos. Verificá que los 4 grupos tengan resultados completos.');
        return;
      }
      for (const slot of slots) {
        await createMatch(event.id, slot.pairAId, slot.pairBId, appUserId, undefined, {
          phase: 'elimination',
          bracketRound: 1,
          bracketPosition: slot.bracketPosition,
        });
      }
      await updateAmericanoPhase(event.id, 'elimination');
      toast.success(`${slots.length} partidos de Octavos generados`);
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
      const currentRound = Math.max(...eliminationMatches.map(m => m.bracketRound || 1));
      const currentRoundMatches = eliminationMatches.filter(m => m.bracketRound === currentRound);

      if (currentRoundMatches.some(m => !m.winnerId)) {
        toast.error('Hay partidos sin resultado en la ronda actual');
        return;
      }

      const nextPairs = planNextEliminationRound(currentRoundMatches, currentRound);
      if (nextPairs.length === 0) {
        toast.error('No hay suficientes ganadores para generar la siguiente ronda');
        return;
      }

      for (let i = 0; i < nextPairs.length; i++) {
        await createMatch(event.id, nextPairs[i][0], nextPairs[i][1], appUserId, undefined, {
          phase: 'elimination',
          bracketRound: currentRound + 1,
          bracketPosition: i + 1,
        });
      }

      if (nextPairs.length === 1) {
        await updateAmericanoPhase(event.id, 'finished');
        toast.success('Final generada');
      } else {
        const label = nextPairs.length === 2 ? 'Semifinal' : nextPairs.length === 4 ? 'Cuartos' : `Ronda ${currentRound + 1}`;
        toast.success(`${nextPairs.length} partidos de ${label} generados`);
      }
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  // --- Result CRUD ---

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

  // --- Render ---

  const renderMatch = (m: Match, locked = false) => {
    const hasResult = !!m.winnerId;
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
        {!readOnly && (
          <MatchKebab
            hasResult={hasResult}
            locked={locked}
            onLoadResult={() => openLoadResult(m)}
            onClearResult={() => setClearResultMatchId(m.id)}
            onDelete={() => setDeleteMatchId(m.id)}
            disabled={isFinished}
          />
        )}
      </div>
    );
  };

  const currentElimRound = eliminationMatches.length > 0
    ? Math.max(...eliminationMatches.map(m => m.bracketRound || 1))
    : 0;
  const currentElimRoundMatches = eliminationMatches.filter(m => m.bracketRound === currentElimRound);
  const currentElimRoundComplete = currentElimRound > 0 && currentElimRoundMatches.every(m => !!m.winnerId);
  const isFinal = currentElimRoundMatches.length === 1 && !!currentElimRoundMatches[0]?.winnerId;

  const showGenRound1 = !readOnly && groups.length > 0 && round1Matches.length === 0;
  const showGenRound2 = !readOnly && allRound1HaveResult && round2Matches.length === 0;
  const showGenOctavos = !readOnly && allRound2HaveResult && eliminationMatches.length === 0;
  const showAdvanceElim = !readOnly && phase === 'elimination' && currentElimRoundComplete && !isFinal;

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      {(showGenRound1 || showGenRound2 || showGenOctavos || showAdvanceElim) && (
        <div className="flex flex-wrap gap-3">
          {showGenRound1 && (
            <Button onClick={handleGenerateRound1} loading={busy} disabled={isFinished}>
              Generar Ronda 1
            </Button>
          )}
          {showGenRound2 && (
            <Button onClick={handleGenerateRound2} loading={busy} disabled={isFinished}>
              Generar Ronda 2
            </Button>
          )}
          {showGenOctavos && (
            <Button onClick={handleGenerateOctavos} loading={busy} disabled={isFinished}>
              Generar Octavos
            </Button>
          )}
          {showAdvanceElim && (
            <Button onClick={handleAdvanceEliminationRound} loading={busy} disabled={isFinished}>
              Generar siguiente ronda
            </Button>
          )}
        </div>
      )}

      {/* Group stage */}
      {(round1Matches.length > 0 || round2Matches.length > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Fase de Grupos
          </h3>
          <div className="space-y-4">
            {groups.map(group => {
              const gRound1 = round1Matches.filter(m => m.groupNumber === group.groupNumber);
              const gRound2 = round2Matches.filter(m => m.groupNumber === group.groupNumber);
              if (gRound1.length === 0 && gRound2.length === 0) return null;
              const label = String.fromCharCode(64 + group.groupNumber);
              return (
                <Card key={group.id}>
                  <CardContent className="py-4">
                    <h4 className="text-sm font-semibold mb-3">Grupo {label}</h4>
                    {gRound1.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wide">Ronda 1</p>
                        <div className="space-y-2">
                          {gRound1.map(m => renderMatch(m, isGroupPhaseLocked))}
                        </div>
                      </div>
                    )}
                    {gRound2.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wide">Ronda 2</p>
                        <div className="space-y-2">
                          {gRound2.map(m => renderMatch(m, isGroupPhaseLocked))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
                const roundMatches = eliminationMatches
                  .filter(m => m.bracketRound === round)
                  .sort((a, b) => (a.bracketPosition || 0) - (b.bracketPosition || 0));
                const isRoundLocked = round < currentElimRound;
                const label =
                  roundMatches.length === 1 ? 'Final' :
                  roundMatches.length === 2 ? 'Semifinal' :
                  roundMatches.length === 4 ? 'Cuartos de Final' :
                  roundMatches.length === 8 ? 'Octavos de Final' :
                  `Ronda ${round}`;
                return (
                  <Card key={round}>
                    <CardContent className="py-4">
                      <h4 className="text-sm font-semibold mb-3">{label}</h4>
                      {round === 1 && (
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wide">Grupo A vs Grupo C</p>
                            <div className="space-y-2">
                              {roundMatches.filter(m => (m.bracketPosition || 0) <= 4).map(m => renderMatch(m, isRoundLocked))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wide">Grupo B vs Grupo D</p>
                            <div className="space-y-2">
                              {roundMatches.filter(m => (m.bracketPosition || 0) > 4).map(m => renderMatch(m, isRoundLocked))}
                            </div>
                          </div>
                        </div>
                      )}
                      {round !== 1 && (
                        <div className="space-y-2">
                          {roundMatches.map(m => renderMatch(m, isRoundLocked))}
                        </div>
                      )}
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
              Campeón: {getPairName(currentElimRoundMatches[0].winnerId)}
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
                groups.length === 0 ? 'Distribuí las parejas en grupos primero' :
                phase === 'setup' || phase === 'groups' ? 'Generá la Ronda 1 para empezar' :
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
            onClick={() => { primeKeyboard(); onLoadResult(); setOpen(false); }}
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
