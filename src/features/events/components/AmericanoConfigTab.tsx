import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { AMERICANO_PHASES } from '@/utils/constants';
import { validateAmericanoConfig, type ConfigValidation } from '@/utils/americano';
import type { PadelEvent, Registration, EventPair, AmericanoConfig, AmericanoPhase } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  event: PadelEvent;
  registrations: Registration[];
  pairs: EventPair[];
  onSaveConfig: (config: AmericanoConfig) => Promise<void>;
  onAdvancePhase: (phase: AmericanoPhase) => Promise<void>;
  onReset: () => Promise<void>;
  isFinished: boolean;
  readOnly?: boolean;
}

export function AmericanoConfigTab({ event, registrations, pairs, onSaveConfig, onAdvancePhase, onReset, isFinished, readOnly = false }: Props) {
  const config = event.americanoConfig;
  const phase = event.americanoPhase || 'setup';

  const [minMatches, setMinMatches] = useState(config?.minMatches?.toString() || '3');
  const [groupCount, setGroupCount] = useState(config?.groupCount?.toString() || '2');
  const [directQualifiers, setDirectQualifiers] = useState(config?.directQualifiers?.toString() || '1');
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<ConfigValidation | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

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

  const totalPairs = pairs.length;
  const activePlayers = registrations.filter(r => r.status === 'active').length;

  const estimatedPairs = totalPairs > 0 ? totalPairs : Math.floor(activePlayers / 2);

  useEffect(() => {
    const mm = parseInt(minMatches) || 0;
    const gc = parseInt(groupCount) || 0;
    const dq = parseInt(directQualifiers) || 0;
    if (mm >= 2 && gc >= 1 && dq >= 1) {
      if (estimatedPairs >= 2) {
        setValidation(validateAmericanoConfig({ minMatches: mm, groupCount: gc, directQualifiers: dq }, estimatedPairs));
      } else {
        setValidation({ errors: [], warnings: ['Todavía no hay suficientes parejas/jugadores para validar'], summary: null });
      }
    } else {
      setValidation(null);
    }
  }, [minMatches, groupCount, directQualifiers, estimatedPairs]);

  const handleSave = async () => {
    const mm = parseInt(minMatches);
    const gc = parseInt(groupCount);
    const dq = parseInt(directQualifiers);
    if (isNaN(mm) || isNaN(gc) || isNaN(dq)) return;
    if (validation?.errors.length) return;
    setSaving(true);
    try {
      await onSaveConfig({ minMatches: mm, groupCount: gc, directQualifiers: dq });
    } finally {
      setSaving(false);
    }
  };

  const canAdvanceToGroups = phase === 'setup' && config && totalPairs >= 4 && !validation?.errors.length;

  const inputClass = 'block w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Fase actual</h3>
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {AMERICANO_PHASES[phase]}
            </Badge>
          </div>
          <div className="flex gap-1 mb-2">
            {(Object.keys(AMERICANO_PHASES) as AmericanoPhase[]).map((p, i) => (
              <div
                key={p}
                className={`h-2 flex-1 rounded-full ${
                  Object.keys(AMERICANO_PHASES).indexOf(phase) >= i
                    ? 'bg-blue-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {activePlayers} jugadores inscriptos · {totalPairs} parejas armadas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <h3 className="font-semibold mb-4">Parámetros del torneo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Partidos mínimos por pareja
              </label>
              <input
                type="number"
                min="2"
                max="20"
                value={minMatches}
                onChange={(e) => setMinMatches(e.target.value)}
                disabled={phase !== 'setup' || isFinished || readOnly}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cantidad de grupos
              </label>
              <input
                type="number"
                min="1"
                max="16"
                value={groupCount}
                onChange={(e) => setGroupCount(e.target.value)}
                disabled={phase !== 'setup' || isFinished || readOnly}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Clasificados directos por grupo
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={directQualifiers}
                onChange={(e) => setDirectQualifiers(e.target.value)}
                disabled={phase !== 'setup' || isFinished || readOnly}
                className={inputClass}
              />
            </div>
          </div>

          {validation && (
            <div className="mt-4 space-y-2">
              {validation.errors.map((e, i) => (
                <p key={i} className="text-sm text-red-600 dark:text-red-400">✗ {e}</p>
              ))}
              {validation.warnings.map((w, i) => (
                <p key={i} className="text-sm text-yellow-600 dark:text-yellow-400">⚠ {w}</p>
              ))}
              {validation.errors.length === 0 && validation.summary && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm space-y-1">
                  <p><strong>Resumen:</strong></p>
                  <p>Grupos: {validation.summary.pairsPerGroup.map((n, i) => `Grupo ${i + 1}: ${n} parejas`).join(' · ')}</p>
                  <p>Partidos de grupo por pareja: {parseInt(minMatches) || 2}</p>
                  <p>Repechaje: {validation.summary.repechajePool} parejas</p>
                  <p>Cuadro eliminatorio: {validation.summary.totalElimination} parejas → {validation.summary.bracketSize} slots</p>
                </div>
              )}
            </div>
          )}

          {phase === 'setup' && !readOnly && (
            <div className="flex gap-3 mt-4">
              <Button onClick={handleSave} loading={saving} disabled={isFinished || !validation || validation.errors.length > 0}>
                Guardar configuración
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {canAdvanceToGroups && !readOnly && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Cuando las parejas estén armadas y los grupos distribuidos, avanzá a la fase de grupos para generar el fixture.
            </p>
            <Button onClick={() => onAdvancePhase('groups')} disabled={isFinished}>
              Avanzar a Fase de Grupos
            </Button>
          </CardContent>
        </Card>
      )}

      {!isFinished && !readOnly && (phase !== 'setup' || pairs.length > 0) && (
        <Card className="border border-red-200 dark:border-red-900/50">
          <CardContent className="py-4">
            <h3 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" /> Zona de peligro
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Reset completo: borra parejas, grupos, partidos y resultados; recalcula el ranking global y vuelve la fase a <strong>setup</strong>. La configuración se conserva.
            </p>
            <Button variant="danger" onClick={() => setResetOpen(true)}>
              Resetear americano
            </Button>
          </CardContent>
        </Card>
      )}

      <Modal open={resetOpen} onClose={() => { setResetOpen(false); setResetConfirmText(''); }} title="Resetear americano">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Esta acción <strong>no se puede deshacer</strong>. Se van a borrar {pairs.length} parejas, todos los grupos y todos los partidos del evento. El ranking global se recalculará.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Para confirmar, escribí el nombre del evento: <strong>{event.name}</strong>
          </p>
          <Input
            placeholder={event.name}
            value={resetConfirmText}
            onChange={e => setResetConfirmText(e.target.value)}
          />
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
