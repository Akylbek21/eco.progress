import { Alert, Chip, Skeleton } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FlaskConical, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../../components/ui/Button';
import { normalizeApiError } from '../../../../services/apiHelpers';
import protocolService from '../../../../services/protocolService';
import type { Protocol } from '../../../../types/protocols';
import { pekKeys } from '../../../pek/api/pekQueryKeys';
import type { ProtocolCreationRequirement, ProtocolCreationRequirementStatus } from '../../api/protocolCreationContracts';
import { protocolQueryKeys, protocolScope } from '../../hooks/queryKeys';
import { useProtocolCreationContext } from '../../hooks/useProtocolCreationContext';

const statusOrder: Record<ProtocolCreationRequirementStatus, number> = {
  OVERDUE: 0,
  DUE: 1,
  CONFIGURATION_REQUIRED: 2,
  NOT_DUE: 3,
  COMPLETED: 4,
};

const statusView: Record<ProtocolCreationRequirementStatus, { label: string; color: 'error' | 'warning' | 'success' | 'default' }> = {
  DUE: { label: 'Нужно выполнить', color: 'warning' },
  OVERDUE: { label: 'Просрочено', color: 'error' },
  COMPLETED: { label: 'Выполнено', color: 'success' },
  NOT_DUE: { label: 'Не требуется сейчас', color: 'default' },
  CONFIGURATION_REQUIRED: { label: 'Нужно настроить ПЭК', color: 'warning' },
};

const periodLabel = (period?: { label?: string; year?: number; quarter?: number }) => {
  if (period?.label) return period.label;
  const quarters = ['', 'I квартал', 'II квартал', 'III квартал', 'IV квартал'];
  return [period?.quarter ? quarters[period.quarter] : '', period?.year || ''].filter(Boolean).join(' ');
};

const creationPayload = (requirement: ProtocolCreationRequirement) => ({
  companyId: requirement.companyId,
  objectId: requirement.objectId,
  pekProgramId: requirement.pekProgramId,
  pekMonitoringId: requirement.pekMonitoringId,
  pekControlItemId: requirement.pekControlItemId,
  monitoringPointId: requirement.monitoringPointId,
  protocolTemplateId: requirement.protocolTemplateId,
});

export default function PekProtocolRequirementsStep({
  companyId,
  objectId,
  date,
  companyName,
  objectName,
  userId,
  canOpenPek,
  onManual,
  onCreated,
}: {
  companyId: string;
  objectId: string;
  date: string;
  companyName: string;
  objectName: string;
  userId?: string | number;
  canOpenPek: boolean;
  onManual: () => void;
  onCreated: (protocol: Protocol) => void;
}) {
  const queryClient = useQueryClient();
  const scope = protocolScope(userId);
  const contextQuery = useProtocolCreationContext({ companyId, objectId, date });
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<{ code?: string; message: string; protocolId?: string } | null>(null);

  useEffect(() => {
    setSelectedRequirementId(null);
    setCreationError(null);
  }, [companyId, objectId]);

  const createMutation = useMutation({
    mutationFn: (requirement: ProtocolCreationRequirement) => protocolService.createProtocolFromPek(creationPayload(requirement)),
    onMutate: (requirement) => {
      setSelectedRequirementId(requirement.id);
      setCreationError(null);
    },
    onSuccess: async (protocol) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['protocol-creation-context'] }),
        queryClient.invalidateQueries({ queryKey: protocolQueryKeys.all(scope) }),
        queryClient.invalidateQueries({ queryKey: pekKeys.root }),
      ]);
      onCreated(protocol);
    },
    onError: (error, requirement) => {
      const normalized = normalizeApiError(error, 'Не удалось создать протокол по позиции ПЭК.');
      if (normalized.code === 'PROTOCOL_DRAFT_ALREADY_EXISTS') {
        setCreationError({
          code: normalized.code,
          message: 'Для этой задачи уже существует черновик протокола.',
          protocolId: String(normalized.resourceId ?? requirement.existingDraftProtocolId ?? '') || undefined,
        });
        return;
      }
      if (normalized.code === 'PROTOCOL_PLAN_ALREADY_COMPLETED') {
        setCreationError({ code: normalized.code, message: 'План на этот период уже выполнен.' });
        return;
      }
      if (normalized.code === 'CONFIGURATION_REQUIRED') {
        setCreationError({ code: normalized.code, message: 'Для этой позиции ПЭК не настроен тип протокола.' });
        return;
      }
      setCreationError({ code: normalized.code, message: normalized.message });
    },
  });

  const openExisting = async () => {
    if (!creationError?.protocolId) return;
    try {
      onCreated(await protocolService.getProtocol(creationError.protocolId));
    } catch (error) {
      setCreationError({ message: normalizeApiError(error, 'Не удалось открыть существующий черновик.').message });
    }
  };

  if (contextQuery.isLoading) return <section aria-label="Загрузка требований ПЭК" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><Skeleton variant="text" width="45%" height={36} /><Skeleton variant="rounded" height={190} /><Skeleton variant="rounded" height={190} /></section>;
  if (contextQuery.isError) return <Alert severity="error" action={<Button type="button" variant="secondary" onClick={() => void contextQuery.refetch()}>Повторить</Button>}>{normalizeApiError(contextQuery.error, 'Не удалось загрузить задачи ПЭК.').message}</Alert>;

  const context = contextQuery.data;
  if (!context) return null;
  if (!context.hasActiveProgram) return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
    <h2 className="text-xl font-bold text-amber-950">Для этой компании нет действующей программы ПЭК.</h2>
    <p className="mt-2 text-sm text-amber-900">Можно создать обычный протокол вручную или перейти к настройке программы ПЭК.</p>
    <div className="mt-5 flex flex-wrap gap-3"><Button type="button" variant="secondary" onClick={onManual}>Создать протокол вручную</Button>{canOpenPek && <Button asChild><Link to="/staff/pek">Перейти в ПЭК</Link></Button>}</div>
  </section>;

  const requirements = [...context.requirements].sort((left, right) => statusOrder[left.status] - statusOrder[right.status]);
  return <section className="space-y-5">
    <div className="rounded-2xl border border-eco-200 bg-gradient-to-br from-white to-eco-50 p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-eco-700">Что необходимо выполнить по ПЭК</p><h2 className="mt-2 text-2xl font-bold text-slate-950">{context.company.name || companyName}</h2><p className="mt-1 flex items-center gap-2 text-sm text-slate-600"><MapPin className="h-4 w-4" /> Объект: {context.object.name || objectName}</p></div>
        <div className="rounded-xl border border-eco-200 bg-white px-4 py-3 text-sm text-eco-950"><p className="font-bold">Программа ПЭК{context.program?.number ? ` №${context.program.number}` : ''}</p>{periodLabel(context.period) && <p className="mt-1 text-slate-600">{periodLabel(context.period)}</p>}</div>
      </div>
    </div>

    {creationError && <Alert severity={creationError.code === 'PROTOCOL_PLAN_ALREADY_COMPLETED' ? 'warning' : 'error'} action={creationError.code === 'PROTOCOL_DRAFT_ALREADY_EXISTS' && creationError.protocolId ? <Button type="button" variant="secondary" onClick={() => void openExisting()}>Открыть протокол</Button> : undefined}>{creationError.message}</Alert>}

    {requirements.length === 0 && <Alert severity="info">Backend не вернул задач ПЭК для выбранного объекта и периода.</Alert>}
    <div className="space-y-4">
      {requirements.map((requirement) => {
        const status = statusView[requirement.status];
        const isCreating = createMutation.isPending && selectedRequirementId === requirement.id;
        const canCreate = requirement.canCreate && requirement.missingCount > 0 && requirement.status !== 'COMPLETED' && requirement.status !== 'CONFIGURATION_REQUIRED';
        return <article key={`${requirement.id}:${String(requirement.monitoringPointId ?? 'no-point')}`} className={`rounded-2xl border bg-white p-5 shadow-sm ${requirement.status === 'OVERDUE' ? 'border-rose-200' : requirement.status === 'DUE' ? 'border-amber-200' : 'border-slate-200'}`}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-slate-950">{requirement.title}</h3><Chip size="small" color={status.color} label={status.label} /></div>{requirement.subtitle && <p className="mt-1 text-sm text-slate-600">{requirement.subtitle}</p>}{requirement.frequency && <p className="mt-2 text-sm font-medium text-slate-700">{requirement.frequency}</p>}{requirement.monitoringPointName && <p className="mt-3 flex items-center gap-2 font-semibold text-eco-900"><MapPin className="h-4 w-4" /> {requirement.monitoringPointName}</p>}</div>
            <div className="grid shrink-0 grid-cols-3 gap-2 text-center text-sm"><div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">План</p><p className="font-bold">{requirement.planCount}</p></div><div className="rounded-xl bg-emerald-50 px-3 py-2"><p className="text-xs text-emerald-700">Выполнено</p><p className="font-bold text-emerald-900">{requirement.completedCount}</p></div><div className="rounded-xl bg-amber-50 px-3 py-2"><p className="text-xs text-amber-700">Осталось</p><p className="font-bold text-amber-950">{requirement.missingCount}</p></div></div>
          </div>
          {requirement.indicators.length > 0 && <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Показатели из ПЭК</p><div className="mt-2 flex flex-wrap gap-2">{requirement.indicators.map((indicator) => <span key={indicator.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">{indicator.name}{indicator.normativeLabel ? ` · ${indicator.normativeLabel}` : ''}{indicator.unit ? ` ${indicator.unit}` : ''}</span>)}</div></div>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><div className="text-sm text-slate-600">{requirement.protocolTemplateName && <span>Тип: <strong>{requirement.protocolTemplateName}</strong></span>}{requirement.laboratoryName && <span className="ml-3">Лаборатория: <strong>{requirement.laboratoryName}</strong></span>}</div>{canCreate ? <Button type="button" disabled={createMutation.isPending} onClick={() => createMutation.mutate(requirement)}>{isCreating ? 'Создаём…' : <><FlaskConical className="h-4 w-4" /> Создать протокол</>}</Button> : requirement.status === 'COMPLETED' && requirement.missingCount === 0 ? <span className="inline-flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> Выполнено</span> : requirement.status === 'CONFIGURATION_REQUIRED' ? <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800"><AlertTriangle className="h-5 w-5" /> Для этой позиции ПЭК не настроен тип протокола.</span> : null}</div>
        </article>;
      })}
    </div>
  </section>;
}
