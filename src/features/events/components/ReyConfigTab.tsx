import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
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
}

function newCourtId() {
  return 'c_' + Math.random().toString(36).slice(2, 10);
}

export function ReyConfigTab({ event, pairs, hasMatches, onSaveConfig, onReset, isFinished }: Props) {
  const existing = event.reyConfig;

  const [courts, setCourts] = useState<ReyCourt[]>(existing?.courts ?? [
    { id: newCourtId(), name: 'Cancha 3', order: 1 },
    { id: newCourtId(), name: 'Cancha 4', order: 2 },
    { id: newCourtId(), name: 'Cancha 5', order: 3 },
  ]);
  const [winnersCourtId, setWinnersCourtId] = useState(existing?.winnersCourtId || '');
  const [losersCourtId, setLosersCourtId] = useState(existing?.losersCourtId || '');
  const [seedMode, setSeedMode] = useState<'random' | 'manual'>(existing?.seedMode || 'random');
  const [saving, setSaving] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Default references to first and last court if none set
  useEffect(() => {
    const sorted = [...courts].sort((a, b) => a.order - b.order);
    if (!winnersCourtId && sorted.length > 0) setWinnersCourtId(sorted[0].id);
    if (!losersCourtId && sorted.length > 0) setLosersCourtId(sorted[sorted.length - 1].id);
  }, [courts, winnersCourtId, losersCourtId]);

  const locked = hasMatches || isFinished;

  const config: ReyConfig = {
    courts: [...courts].sort((a, b) => a.order - b.order),
    winnersCourtId,
    losersCourtId,
    seedMode,
  };
  const validation = validateReyConfig(config, pairs.length);

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

  const moveCourt = (id: string, direction: -1 | 1) => {
    const sorted = [...courts].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(c => c.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const tmp = sorted[idx].order;
    sorted[idx].order = sorted[swapIdx].order;
    sorted[swapIdx].order = tmp;
    setCourts([...sorted]);
  };

  const handleSave = async () => {
    if (validation.errors.length > 0) return;
    setSaving(true);
    try {
      await onSaveConfig(config);
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al resetear');
    } finally {
      setResetLoading(false);
    }
  };

  const sortedCourts = [...courts].sort((a, b) => a.order - b.order);
  const courtOptions = sortedCourts.map(c => ({ value: c.id, label: c.name }));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <h3 className="font-semibold mb-3">Canchas</h3>
          {locked && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-3">
              🔒 Hay rondas generadas. Reseteá para cambiar las canchas.
            </p>
          )}
          <div className="space-y-2">
            {sortedCourts.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
                <Input
                  value={c.name}
                  onChange={e => renameCourt(c.id, e.target.value)}
                  disabled={locked}
                />
                <Button variant="ghost" size="sm" onClick={() => moveCourt(c.id, -1)} disabled={locked || i === 0}>↑</Button>
                <Button variant="ghost" size="sm" onClick={() => moveCourt(c.id, 1)} disabled={locked || i === sortedCourts.length - 1}>↓</Button>
                <Button variant="ghost" size="sm" onClick={() => removeCourt(c.id)} disabled={locked || courts.length <= 1}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={addCourt} disabled={locked} className="mt-3">
            <Plus className="h-4 w-4 mr-1" /> Agregar cancha
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <h3 className="font-semibold mb-3">Parámetros</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Criterio de orden inicial</label>
              <select
                value={seedMode}
                onChange={e => setSeedMode(e.target.value as 'random' | 'manual')}
                disabled={locked}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="random">Aleatorio</option>
                <option value="manual">Manual (por cancha)</option>
              </select>
            </div>
            <Select
              label="Cancha de referencia de ganadores"
              options={[{ value: '', label: '—' }, ...courtOptions]}
              value={winnersCourtId}
              onChange={e => setWinnersCourtId(e.target.value)}
              disabled={locked}
            />
            <Select
              label="Cancha de referencia de perdedores"
              options={[{ value: '', label: '—' }, ...courtOptions]}
              value={losersCourtId}
              onChange={e => setLosersCourtId(e.target.value)}
              disabled={locked}
            />
          </div>

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

          <div className="mt-4">
            <Button onClick={handleSave} loading={saving} disabled={locked || validation.errors.length > 0}>
              Guardar configuración
            </Button>
          </div>
        </CardContent>
      </Card>

      {!isFinished && (hasMatches || pairs.length > 0) && (
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
