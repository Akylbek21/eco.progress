import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import { useState } from 'react';
import type { PekProgram } from '../../api/pekContracts';
import { pekApi } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';

export default function PekIndicatorPermitLimits({ program }: { program: PekProgram }) {
  const queryClient = useQueryClient();
  const limits = useQuery({ queryKey: ['pek', 'program', program.id, 'permit-limits'], queryFn: ({ signal }) => pekApi.getProgramPermitLimits(program.id, signal) });
  const [selection, setSelection] = useState<Record<number, number | ''>>({});
  const link = useMutation({ mutationFn: ({ indicatorId, permitLimitId }: { indicatorId: number; permitLimitId: number | null }) => pekApi.linkIndicatorPermitLimit(program.id, indicatorId, permitLimitId, program.version), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pek', 'program', program.id] }) });
  if (limits.isLoading) return <p>Загрузка лимитов разрешений…</p>;
  if (limits.isError) return <Alert severity="error">{mapPekError(limits.error).message}</Alert>;
  return <section className="space-y-3 rounded-2xl border bg-white p-5"><div><h2 className="font-black">Нормативы из действующего разрешения</h2><p className="text-sm text-slate-500">Свяжите показатель программы с лимитом действующей редакции разрешения.</p></div>{!limits.data?.length ? <Alert severity="warning">Нет доступных лимитов. Создайте и активируйте редакцию разрешения.</Alert> : <div className="space-y-2">{(program.indicators || []).filter((indicator) => indicator.id).map((indicator) => <div key={indicator.id} className="grid items-center gap-2 rounded-xl border p-3 md:grid-cols-[1fr_2fr_auto_auto]"><b>{indicator.indicatorName}</b><TextField select size="small" label="Лимит разрешения" value={selection[indicator.id!] ?? ''} disabled={!program.availableActions.edit} onChange={(event) => setSelection((current) => ({ ...current, [indicator.id!]: event.target.value === '' ? '' : Number(event.target.value) }))}><MenuItem value="">Не выбран</MenuItem>{limits.data.map((entry) => <MenuItem key={entry.limitId} value={entry.limitId}>{entry.permitNumber} · ред. {entry.revisionNumber} · {entry.limit.substanceName || entry.limit.substanceCode || `лимит №${entry.limitId}`}</MenuItem>)}</TextField><Button disabled={!program.availableActions.edit || selection[indicator.id!] === undefined || link.isPending} onClick={() => link.mutate({ indicatorId: indicator.id!, permitLimitId: selection[indicator.id!] === '' ? null : Number(selection[indicator.id!]) })}>Связать</Button><Button disabled={!program.availableActions.edit || link.isPending} onClick={() => link.mutate({ indicatorId: indicator.id!, permitLimitId: null })}>Отвязать</Button></div>)}</div>}{link.error && <Alert severity="error">{mapPekError(link.error).message}</Alert>}</section>;
}
