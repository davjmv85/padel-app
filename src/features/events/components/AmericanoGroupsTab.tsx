import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { distributeInGroups } from '@/utils/americano';
import { PLAYER_POSITIONS } from '@/utils/constants';
import { computePairRecords, pairRecordLabel } from '@/utils/format';
import { createGroup, deleteEventGroups } from '../services/groupService';
import type { PadelEvent, EventPair, EventGroup, Registration, Match } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  event: PadelEvent;
  pairs: EventPair[];
  groups: EventGroup[];
  matches: Match[];
  registrations: Registration[];
  onReload: () => Promise<void>;
  isFinished: boolean;
  readOnly?: boolean;
}

export function AmericanoGroupsTab({ event, pairs, groups, matches, registrations, onReload, isFinished, readOnly = false }: Props) {
  const pairRecords = computePairRecords(matches);
  const [busy, setBusy] = useState(false);
  const [manualPair, setManualPair] = useState('');
  const [manualGroup, setManualGroup] = useState('');

  const config = event.americanoConfig;
  const phase = event.americanoPhase || 'setup';
  const canEdit = phase === 'setup' && !isFinished && !readOnly;

  const getPairName = (pairId: string) => {
    const p = pairs.find(pr => pr.id === pairId);
    return p ? `${p.player1Name} / ${p.player2Name}` : 'Desconocida';
  };

  const getPairPositions = (pairId: string) => {
    const p = pairs.find(pr => pr.id === pairId);
    if (!p) return '';
    const p1Pos = registrations.find(r => r.userId === p.player1Id)?.userPosition;
    const p2Pos = registrations.find(r => r.userId === p.player2Id)?.userPosition;
    return [p1Pos && PLAYER_POSITIONS[p1Pos], p2Pos && PLAYER_POSITIONS[p2Pos]].filter(Boolean).join(' / ');
  };

  const assignedPairIds = new Set(groups.flatMap(g => g.pairIds));
  const unassignedPairs = pairs.filter(p => !assignedPairIds.has(p.id));

  const handleAutoDistribute = async () => {
    if (!config || pairs.length === 0) return;
    setBusy(true);
    try {
      await deleteEventGroups(event.id);
      const distribution = distributeInGroups(pairs.map(p => p.id), config.groupCount);
      for (let i = 0; i < distribution.length; i++) {
        await createGroup(event.id, i + 1, distribution[i]);
      }
      toast.success('Parejas distribuidas en grupos');
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleManualAssign = async () => {
    if (!manualPair || !manualGroup) return;
    const groupNum = parseInt(manualGroup);
    const group = groups.find(g => g.groupNumber === groupNum);
    setBusy(true);
    try {
      if (group) {
        await deleteEventGroups(event.id);
        const updatedGroups = groups.map(g => {
          if (g.groupNumber === groupNum) {
            return { ...g, pairIds: [...g.pairIds, manualPair] };
          }
          return { ...g, pairIds: g.pairIds.filter(id => id !== manualPair) };
        });
        for (const g of updatedGroups) {
          await createGroup(event.id, g.groupNumber, g.pairIds);
        }
      } else {
        await createGroup(event.id, groupNum, [manualPair]);
      }
      setManualPair('');
      setManualGroup('');
      toast.success('Pareja asignada');
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleClearGroups = async () => {
    setBusy(true);
    try {
      await deleteEventGroups(event.id);
      toast.success('Grupos eliminados');
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const groupOptions = config
    ? Array.from({ length: config.groupCount }, (_, i) => ({
        value: String(i + 1),
        label: `Grupo ${String.fromCharCode(65 + i)}`,
      }))
    : [];

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-3 items-end">
              <Button onClick={handleAutoDistribute} loading={busy} disabled={pairs.length === 0 || !config}>
                Auto-distribuir
              </Button>
              <Button variant="secondary" onClick={handleClearGroups} loading={busy} disabled={groups.length === 0}>
                Limpiar grupos
              </Button>
            </div>
            {unassignedPairs.length > 0 && config && (
              <div className="mt-4 flex flex-wrap gap-3 items-end">
                <Select
                  label="Pareja"
                  options={[
                    { value: '', label: 'Seleccionar pareja' },
                    ...unassignedPairs.map(p => ({ value: p.id, label: `${p.player1Name} / ${p.player2Name}` })),
                  ]}
                  value={manualPair}
                  onChange={e => setManualPair(e.target.value)}
                />
                <Select
                  label="Grupo"
                  options={[{ value: '', label: 'Seleccionar grupo' }, ...groupOptions]}
                  value={manualGroup}
                  onChange={e => setManualGroup(e.target.value)}
                />
                <Button variant="secondary" onClick={handleManualAssign} loading={busy} disabled={!manualPair || !manualGroup}>
                  Asignar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!config && (
        <Card>
          <CardContent className="py-4">
            <EmptyState title="Sin configuración" description="Primero configurá los parámetros del torneo en la pestaña Configuración" />
          </CardContent>
        </Card>
      )}

      {config && pairs.length === 0 && (
        <Card>
          <CardContent className="py-4">
            <EmptyState title="Sin parejas" description="Primero armá las parejas en la pestaña Parejas" />
          </CardContent>
        </Card>
      )}

      {config && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map(group => (
            <Card key={group.id}>
              <CardContent className="py-4">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Grupo {String.fromCharCode(64 + group.groupNumber)} ({group.pairIds.length} parejas)
                </h3>
                {group.pairIds.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin parejas asignadas</p>
                ) : (
                  <div className="space-y-2">
                    {group.pairIds.map((pairId, idx) => (
                      <div key={pairId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div>
                          <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{idx + 1}:</span>{' '}
                          <span className="font-medium">{getPairName(pairId)}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">({getPairPositions(pairId)})</span>
                          <span className="ml-2 text-xs font-semibold text-gray-500 dark:text-gray-400">({pairRecordLabel(pairRecords, pairId)})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {unassignedPairs.length > 0 && groups.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <h3 className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 mb-2">
              Parejas sin grupo ({unassignedPairs.length})
            </h3>
            <div className="space-y-1">
              {unassignedPairs.map(p => (
                <p key={p.id} className="text-sm text-gray-600 dark:text-gray-400">
                  {p.player1Name} / {p.player2Name}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
