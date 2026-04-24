import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { AMERICANO_PHASES } from '@/utils/constants';
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
  const phase = event.americanoPhase || 'setup';
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const totalPairs = pairs.length;
  const activePlayers = registrations.filter(r => r.status === 'active').length;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveConfig({ groupCount: 4 });
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

  const canAdvanceToGroups = phase === 'setup' && event.americanoConfig && totalPairs >= 16;
  const pairError = totalPairs < 16 ? `Faltan ${16 - totalPairs} parejas para completar los 4 grupos de 4.` : null;
  const configSaved = !!event.americanoConfig;

  return (
    <div className="space-y-4">
      {/* Phase indicator */}
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

      {/* Format summary */}
      <Card>
        <CardContent className="py-4">
          <h3 className="font-semibold mb-3">Formato del torneo</h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <p><span className="font-medium">Grupos:</span> 4 grupos de 4 parejas (16 parejas en total)</p>
            <p><span className="font-medium">Fase de grupos:</span> Ronda 1 aleatoria + Ronda 2 (ganadores vs ganadores, perdedores vs perdedores)</p>
            <p><span className="font-medium">Eliminatoria:</span> Octavos (A vs C, B vs D) → Cuartos → Semifinal → Final</p>
            <p><span className="font-medium">Partidos por pareja:</span> mínimo 3 (2 en grupos + octavos)</p>
          </div>

          {pairError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">✗ {pairError}</p>
          )}
          {!pairError && totalPairs > 0 && (
            <p className="mt-3 text-sm text-green-600 dark:text-green-400">✓ {totalPairs} parejas listas para 4 grupos de 4</p>
          )}

          {phase === 'setup' && !readOnly && (
            <div className="mt-4">
              <Button onClick={handleSave} loading={saving} disabled={isFinished}>
                {configSaved ? 'Confirmar configuración' : 'Guardar configuración'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advance to groups */}
      {canAdvanceToGroups && !readOnly && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Las 16 parejas están armadas y distribuidas en grupos. Avanzá a la fase de grupos para generar el fixture.
            </p>
            <Button onClick={() => onAdvancePhase('groups')} disabled={isFinished}>
              Avanzar a Fase de Grupos
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      {!isFinished && !readOnly && (phase !== 'setup' || pairs.length > 0) && (
        <Card className="border border-red-200 dark:border-red-900/50">
          <CardContent className="py-4">
            <h3 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" /> Zona de peligro
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Reset completo: borra parejas, grupos, partidos y resultados; recalcula el ranking global y vuelve la fase a <strong>setup</strong>.
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
