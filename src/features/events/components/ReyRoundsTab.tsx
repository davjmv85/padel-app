import { useState } from 'react';
import { Pencil, Trash2, MoreVertical, Eraser } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { inverseScore, determineWinner, computePairRecords, pairRecordLabel } from '@/utils/format';
import { primeKeyboard } from '@/utils/iosKeyboardPrimer';
import { updateMatch, deleteMatch, clearMatchResult } from '@/features/matches/services/matchService';
import { generateReyFirstRound, generateReyNextRound } from '../services/reyService';
import { recalculateRankings } from '@/features/ranking/services/rankingService';
import type { PadelEvent, EventPair, Match } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  event: PadelEvent;
  pairs: EventPair[];
  matches: Match[];
  appUserId: string;
  onReload: () => Promise<void>;
  isFinished: boolean;
  readOnly?: boolean;
}

export function ReyRoundsTab({ event, pairs, matches, appUserId, onReload, isFinished, readOnly = false }: Props) {
  const config = event.reyConfig;

  const [busy, setBusy] = useState(false);
  const [resultMatchId, setResultMatchId] = useState<string | null>(null);
  const [resultScoreA, setResultScoreA] = useState('');
  const [resultPairAId, setResultPairAId] = useState('');
  const [resultPairBId, setResultPairBId] = useState('');
  const [resultLoading, setResultLoading] = useState(false);
  const [deleteMatchId, setDeleteMatchId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [clearResultMatchId, setClearResultMatchId] = useState<string | null>(null);
  const [clearResultLoading, setClearResultLoading] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualAssign, setManualAssign] = useState<Record<string, [string, string]>>({});

  if (!config) {
    return (
      <Card><CardContent className="py-4">
        <EmptyState title="Sin configuración" description="Configurá canchas y parámetros primero" />
      </CardContent></Card>
    );
  }

  const pairRecords = computePairRecords(matches);

  const getPairName = (pairId: string | null) => {
    if (!pairId) return '—';
    const p = pairs.find(pr => pr.id === pairId);
    if (!p) return 'Desconocida';
    return `${p.player1Name} / ${p.player2Name} (${pairRecordLabel(pairRecords, p.id)})`;
  };

  const rounds = Array.from(new Set(matches.map(m => m.round!).filter(r => r != null))).sort((a, b) => a - b);
  const currentRound = rounds.length > 0 ? rounds[rounds.length - 1] : 0;
  const currentRoundMatches = matches.filter(m => m.round === currentRound);
  const allCurrentHaveResult = currentRoundMatches.length > 0 && currentRoundMatches.every(m => !!m.winnerId);


  const handleGenerateFirstAuto = async () => {
    if (pairs.length < 2) { toast.error('Agregá al menos 2 parejas'); return; }
    setBusy(true);
    try {
      const { created, resting } = await generateReyFirstRound(event.id, pairs, config, appUserId);
      toast.success(`Ronda 1: ${created} partidos${resting.length ? `, ${resting.length} en descanso` : ''}`);
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const openManualSeeding = () => {
    if (pairs.length < 2) { toast.error('Agregá al menos 2 parejas'); return; }
    const init: Record<string, [string, string]> = {};
    for (const c of [...config.courts].sort((a, b) => a.order - b.order)) init[c.id] = ['', ''];
    setManualAssign(init);
    setManualOpen(true);
  };

  const handleManualConfirm = async () => {
    const assignment: Record<string, string[]> = {};
    const usedIds = new Set<string>();
    for (const [courtId, [a, b]] of Object.entries(manualAssign)) {
      if (!a || !b || a === b) { toast.error('Cada cancha necesita 2 parejas distintas'); return; }
      if (usedIds.has(a) || usedIds.has(b)) { toast.error('Una pareja no puede estar en más de una cancha'); return; }
      usedIds.add(a); usedIds.add(b);
      assignment[courtId] = [a, b];
    }
    setBusy(true);
    try {
      const { created, resting } = await generateReyFirstRound(event.id, pairs, config, appUserId, assignment);
      toast.success(`Ronda 1: ${created} partidos${resting.length ? `, ${resting.length} en descanso` : ''}`);
      setManualOpen(false);
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateNext = async () => {
    if (!allCurrentHaveResult) { toast.error('Completá los resultados de la ronda actual'); return; }
    setBusy(true);
    try {
      const { created, resting } = await generateReyNextRound(event.id, pairs, matches, config, appUserId);
      let msg = `Ronda ${currentRound + 1}: ${created} partidos`;
      if (resting.length) msg += `, ${resting.length} en descanso`;
      toast.success(msg);
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
  };

  const handleSaveResult = async () => {
    if (!resultMatchId || !resultScoreA.trim()) return;
    const winner = determineWinner(resultScoreA);
    if (!winner) { toast.error('Resultado inválido. Formato: "6-4" o "6-4 6-3"'); return; }
    setResultLoading(true);
    try {
      const winnerId = winner === 'A' ? resultPairAId : resultPairBId;
      await updateMatch(resultMatchId, resultScoreA, inverseScore(resultScoreA), winnerId);
      await recalculateRankings();
      toast.success('Resultado guardado');
      setResultMatchId(null);
      setResultScoreA('');
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setResultLoading(false);
    }
  };

  const handleDelete = async () => {
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
      toast.success('Resultado borrado');
      setClearResultMatchId(null);
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setClearResultLoading(false);
    }
  };

  const sortedCourts = [...config.courts].sort((a, b) => a.order - b.order);

  const renderMatch = (m: Match, isCurrent: boolean) => {
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
          <ReyMatchKebab
            hasResult={hasResult}
            canDelete={isCurrent}
            onLoadResult={() => openLoadResult(m)}
            onClearResult={() => setClearResultMatchId(m.id)}
            onDelete={() => setDeleteMatchId(m.id)}
            disabled={isFinished}
          />
        )}
      </div>
    );
  };

  // resting pairs in current round
  const playingInCurrent = new Set<string>();
  for (const m of currentRoundMatches) { playingInCurrent.add(m.pairAId); playingInCurrent.add(m.pairBId); }
  const currentResting = pairs.filter(p => !playingInCurrent.has(p.id));

  return (
    <div className="space-y-6">
      {/* Action bar */}
      {!readOnly && <div className="flex flex-wrap gap-3">
        {rounds.length === 0 && (
          <>
            <Button onClick={handleGenerateFirstAuto} loading={busy} disabled={isFinished || pairs.length < 2}>
              Generar ronda 1 (aleatorio)
            </Button>
            <Button variant="secondary" onClick={openManualSeeding} disabled={isFinished || pairs.length < 2 || busy}>
              Armar ronda 1 manual
            </Button>
          </>
        )}
        {rounds.length > 0 && (
          <Button onClick={handleGenerateNext} loading={busy} disabled={isFinished || !allCurrentHaveResult}>
            Generar ronda {currentRound + 1}
          </Button>
        )}
      </div>}

      {rounds.length === 0 ? (
        <Card><CardContent className="py-4">
          <EmptyState title="Sin rondas" description="Generá la ronda 1 para arrancar" />
        </CardContent></Card>
      ) : (
        <>
          {/* Rounds listing, latest on top */}
          {[...rounds].reverse().map(rn => {
            const rMatches = matches.filter(m => m.round === rn);
            const isCurrent = rn === currentRound;
            return (
              <div key={rn}>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Ronda {rn}{isCurrent ? ' (actual)' : ''}
                </h3>
                <div className="space-y-3">
                  {sortedCourts.map(c => {
                    const m = rMatches.find(x => x.courtId === c.id);
                    if (!m) return null;
                    const isWinners = c.id === config.winnersCourtId;
                    const isLosers = c.id === config.losersCourtId;
                    return (
                      <Card key={c.id}>
                        <CardContent className="py-4">
                          <h4 className="text-sm font-semibold mb-3">
                            {c.name}
                            {isWinners && <span className="ml-2 text-green-600 dark:text-green-400">(+)</span>}
                            {isLosers && <span className="ml-2 text-red-600 dark:text-red-400">(−)</span>}
                          </h4>
                          {renderMatch(m, isCurrent)}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {isCurrent && currentResting.length > 0 && (
                    <Card>
                      <CardContent className="py-4">
                        <h4 className="text-sm font-semibold mb-2 text-gray-500 dark:text-gray-400">Descansan</h4>
                        <div className="flex flex-wrap gap-2">
                          {currentResting.map(p => (
                            <span key={p.id} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">
                              {p.player1Name} / {p.player2Name} ({pairRecordLabel(pairRecords, p.id)})
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Manual seeding modal */}
      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Asignar parejas a canchas (ronda 1)">
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Elegí 2 parejas por cancha. Las parejas sin asignar descansan en la ronda 1.
          </p>
          {sortedCourts.map(c => (
            <div key={c.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <p className="text-sm font-medium mb-2">{c.name}</p>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  options={[{ value: '', label: '—' }, ...pairs.map(p => ({ value: p.id, label: `${p.player1Name} / ${p.player2Name}` }))]}
                  value={manualAssign[c.id]?.[0] || ''}
                  onChange={e => setManualAssign(prev => ({ ...prev, [c.id]: [e.target.value, prev[c.id]?.[1] || ''] }))}
                />
                <Select
                  options={[{ value: '', label: '—' }, ...pairs.map(p => ({ value: p.id, label: `${p.player1Name} / ${p.player2Name}` }))]}
                  value={manualAssign[c.id]?.[1] || ''}
                  onChange={e => setManualAssign(prev => ({ ...prev, [c.id]: [prev[c.id]?.[0] || '', e.target.value] }))}
                />
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={handleManualConfirm} loading={busy}>Crear ronda 1</Button>
          </div>
        </div>
      </Modal>

      {/* Result modal */}
      <Modal open={!!resultMatchId} onClose={() => setResultMatchId(null)} title="Cargar resultado">
        <div className="space-y-4">
          <div className="text-sm">
            <div className="font-medium">{getPairName(resultPairAId)}</div>
            <div className="text-gray-400 dark:text-gray-500 text-xs my-1">vs</div>
            <div className="font-medium">{getPairName(resultPairBId)}</div>
          </div>
          <Input label="Resultado Pareja A" placeholder="Ej: 6-4 o 6-4 6-3" value={resultScoreA} onChange={e => setResultScoreA(e.target.value)} />
          <Input label="Resultado Pareja B (calculado)" value={inverseScore(resultScoreA)} readOnly className="bg-gray-50 dark:bg-gray-900 cursor-not-allowed" />
          {resultScoreA && (() => {
            const w = determineWinner(resultScoreA);
            if (!w) return <p className="text-sm text-red-600 dark:text-red-400">Resultado inválido. Formato: "6-4" o "6-4 6-3"</p>;
            return <p className="text-sm text-green-700 dark:text-green-400">Ganador: <strong>{getPairName(w === 'A' ? resultPairAId : resultPairBId)}</strong></p>;
          })()}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setResultMatchId(null)}>Cancelar</Button>
            <Button onClick={handleSaveResult} loading={resultLoading} disabled={!resultScoreA || !determineWinner(resultScoreA)}>Guardar</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteMatchId} onClose={() => setDeleteMatchId(null)} onConfirm={handleDelete}
        title="Eliminar partido" message="Solo podés eliminar partidos de la ronda actual. El ranking se recalculará."
        confirmLabel="Eliminar" loading={deleteLoading} />
      <ConfirmDialog open={!!clearResultMatchId} onClose={() => setClearResultMatchId(null)} onConfirm={handleClearResult}
        title="Borrar resultado" message="El partido vuelve a pendiente. El cruce se mantiene."
        confirmLabel="Borrar resultado" loading={clearResultLoading} />
    </div>
  );
}

function ReyMatchKebab({
  hasResult,
  canDelete,
  onLoadResult,
  onClearResult,
  onDelete,
  disabled,
}: {
  hasResult: boolean;
  canDelete: boolean;
  onLoadResult: () => void;
  onClearResult: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(!open)} disabled={disabled}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
        <MoreVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
          <button onClick={() => { primeKeyboard(); onLoadResult(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
            <Pencil className="h-4 w-4" />
            {hasResult ? 'Editar resultado' : 'Cargar resultado'}
          </button>
          {hasResult && (
            <button onClick={() => { onClearResult(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
              <Eraser className="h-4 w-4" /> Borrar resultado
            </button>
          )}
          {!hasResult && canDelete && (
            <button onClick={() => { onDelete(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
              <Trash2 className="h-4 w-4" /> Borrar partido
            </button>
          )}
        </div>
      )}
    </div>
  );
}
