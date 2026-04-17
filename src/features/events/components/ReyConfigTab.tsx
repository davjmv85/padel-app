import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { validateReyConfig } from '@/utils/rey';
import type { PadelEvent, EventPair, ReyConfig, ReyCourt } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  event: PadelEvent;
  pairs: EventPair[];
  hasMatches: boolean;
  onSaveConfig: (config: ReyConfig) => Promise<void>;
  onReset: () => Promise<void>;
  isFinished: boolean;
  readOnly?: boolean;
}

function newCourtId() {
  return 'c_' + Math.random().toString(36).slice(2, 10);
}

export function ReyConfigTab({ event, pairs, hasMatches, onSaveConfig, onReset, isFinished, readOnly = false }: Props) {
  const existing = event.reyConfig;

  const [courts, setCourts] = useState<ReyCourt[]>(existing?.courts ?? [
    { id: newCourtId(), name: 'Cancha 3', order: 1 },
    { id: newCourtId(), name: 'Cancha 4', order: 2 },
    { id: newCourtId(), name: 'Cancha 5', order: 3 },
  ]);
  const [winnersCourtId, setWinnersCourtId] = useState(existing?.winnersCourtId || '');
  const [losersCourtId, setLosersCourtId] = useState(existing?.losersCourtId || '');
  const [seedMode] = useState<'random' | 'manual'>(existing?.seedMode || 'random');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Default references to first and last court if none set
  useEffect(() => {
    const sorted = [...courts].sort((a, b) => a.order - b.order);
    if (!winnersCourtId && sorted.length > 0) setWinnersCourtId(sorted[0].id);
    if (!losersCourtId && sorted.length > 0) setLosersCourtId(sorted[sorted.length - 1].id);
  }, [courts, winnersCourtId, losersCourtId]);

  const hardLocked = hasMatches || isFinished || readOnly;

  const config: ReyConfig = {
    courts: [...courts].sort((a, b) => a.order - b.order),
    winnersCourtId,
    losersCourtId,
    seedMode,
  };
  const validation = validateReyConfig(config, pairs.length);

  const isSameConfig = (a: ReyConfig | undefined, b: ReyConfig): boolean => {
    if (!a) return false;
    if (a.winnersCourtId !== b.winnersCourtId) return false;
    if (a.losersCourtId !== b.losersCourtId) return false;
    if (a.seedMode !== b.seedMode) return false;
    const ac = [...a.courts].sort((x, y) => x.order - y.order);
    const bc = [...b.courts].sort((x, y) => x.order - y.order);
    if (ac.length !== bc.length) return false;
    for (let i = 0; i < ac.length; i++) {
      if (ac[i].id !== bc[i].id) return false;
      if (ac[i].name !== bc[i].name) return false;
      if (ac[i].order !== bc[i].order) return false;
    }
    return true;
  };
  const alreadySaved = isSameConfig(existing, config);
  const frozen = alreadySaved && !editing;
  const locked = hardLocked || frozen;

  const addCourt = () => {
    const nextOrder = (courts.length > 0 ? Math.max(...courts.map(c => c.order)) : 0) + 1;
    setCourts(prev => [...prev, { id: newCourtId(), name: `Cancha ${nextOrder}`, order: nextOrder }]);
  };

  const removeCourt = (id: string) => {
    setCourts(prev => prev.filter(c => c.id !== id).map((c, i) => ({ ...c, order: i + 1 })));
    if (winnersCourtId === id) setWinnersCourtId('');
    if (losersCourtId === id) setLosersCourtId('');
  };

  const renameCourt = (id: string, name: string) => {
    setCourts(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  };

  const handleSave = async () => {
    if (validation.errors.length > 0) return;
    if (alreadySaved) {
      // No hay cambios: salir del modo edición sin escribir
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSaveConfig(config);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleResetConfirm = async () => {
    if (resetConfirmText.trim() !== event.name.trim()) {
      toast.error('El nombre no coincide');
      return;
    }
    setResetLoading(true);
    try {
      await onReset();
      setResetOpen(false);
      setResetConfirmText('');
      setEditing(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al resetear');
    } finally {
      setResetLoading(false);
    }
  };

  const sortedCourts = [...courts].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <h3 className="font-semibold mb-3">Canchas</h3>
          {hardLocked && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-3">
              🔒 Hay rondas generadas. Reseteá para cambiar las canchas.
            </p>
          )}
          {frozen && !hardLocked && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              🔒 Configuración guardada. Para cambiarla, reseteá el Rey de Cancha.
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Marcá con <span className="font-semibold text-green-600 dark:text-green-400">(+)</span> la cancha de ganadores y con <span className="font-semibold text-red-600 dark:text-red-400">(−)</span> la de perdedores.
          </p>
          <div className="space-y-2">
            {sortedCourts.map((c) => {
              const isWinners = c.id === winnersCourtId;
              const isLosers = c.id === losersCourtId;
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <Input
                    value={c.name}
                    onChange={e => renameCourt(c.id, e.target.value)}
                    disabled={locked}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWinnersCourtId(isWinners ? '' : c.id)}
                    disabled={locked || isLosers}
                    title="Marcar como cancha de ganadores"
                    className={isWinners
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold'
                      : 'text-gray-400'}
                  >
                    (+)
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLosersCourtId(isLosers ? '' : c.id)}
                    disabled={locked || isWinners}
                    title="Marcar como cancha de perdedores"
                    className={isLosers
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold'
                      : 'text-gray-400'}
                  >
                    (−)
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeCourt(c.id)} disabled={locked || courts.length <= 1}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              );
            })}
          </div>
          <Button variant="secondary" size="sm" onClick={addCourt} disabled={locked} className="mt-3">
            <Plus className="h-4 w-4 mr-1" /> Agregar cancha
          </Button>

          <div className="mt-4 space-y-2">
            {validation.errors.map((e, i) => (
              <p key={i} className="text-sm text-red-600 dark:text-red-400">✗ {e}</p>
            ))}
            {validation.warnings.map((w, i) => (
              <p key={i} className="text-sm text-yellow-600 dark:text-yellow-400">⚠ {w}</p>
            ))}
            {validation.summary && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm space-y-1">
                <p><strong>Resumen:</strong></p>
                <p>Canchas: {validation.summary.totalCourts} · Cupo por ronda: {validation.summary.pairsPerRound} parejas</p>
                {validation.summary.restingPerRound > 0 && <p>Descansan por ronda: {validation.summary.restingPerRound} parejas</p>}
              </div>
            )}
          </div>

          {!readOnly && (
            <div className="mt-4">
              <Button onClick={handleSave} loading={saving} disabled={hardLocked || validation.errors.length > 0 || frozen}>
                {frozen ? 'Configuración guardada' : 'Guardar configuración'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!isFinished && !readOnly && (hasMatches || pairs.length > 0 || frozen) && (
        <Card className="border border-red-200 dark:border-red-900/50">
          <CardContent className="py-4">
            <h3 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" /> Zona de peligro
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Reset completo: borra parejas y todas las rondas/partidos. Recalcula el ranking. Conserva la configuración.
            </p>
            <Button variant="danger" onClick={() => setResetOpen(true)}>
              Resetear Rey de Cancha
            </Button>
          </CardContent>
        </Card>
      )}

      <Modal open={resetOpen} onClose={() => { setResetOpen(false); setResetConfirmText(''); }} title="Resetear Rey de Cancha">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Esta acción <strong>no se puede deshacer</strong>. Se van a borrar {pairs.length} parejas y todos los partidos del evento. El ranking global se recalculará.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Para confirmar, escribí el nombre del evento: <strong>{event.name}</strong>
          </p>
          <Input placeholder={event.name} value={resetConfirmText} onChange={e => setResetConfirmText(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setResetOpen(false); setResetConfirmText(''); }}>Cancelar</Button>
            <Button variant="danger" onClick={handleResetConfirm} loading={resetLoading} disabled={resetConfirmText.trim() !== event.name.trim()}>
              Resetear todo
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
