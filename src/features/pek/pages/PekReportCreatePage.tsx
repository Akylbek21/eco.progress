import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../hooks/useToast';
import type { PekPeriodType, PekReportCreationParams } from '../api/pekContracts';
import type { PekReportCreateRequest } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekCompanyObjectFilters from '../components/common/PekCompanyObjectFilters';
import PekLookupSelect from '../components/common/PekLookupSelect';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState } from '../components/common/PekUi';
import { mapReportCreateRequest } from '../mappers/reportMappers';
import { mapPekError } from '../utils/pekErrorMapper';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2';

const PekReportCreatePage = () => {
  const [initial] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const client = useQueryClient();
  const [companyId, setCompanyId] = useState(Number(initial.get('companyId')) || 0);
  const [objectId, setObjectId] = useState(Number(initial.get('objectId')) || 0);
  const [periodType, setPeriodType] = useState<PekPeriodType>(initial.get('periodType') === 'YEAR' ? 'YEAR' : 'QUARTER');
  const [year, setYear] = useState(Number(initial.get('year')) || new Date().getFullYear());
  const [quarter, setQuarter] = useState(Number(initial.get('quarter')) || 1);
  const [programId, setProgramId] = useState(0);
  const [collectImmediately, setCollectImmediately] = useState(true);
  const [responsibleUserId, setResponsibleUserId] = useState<number | null>(null);
  const params: PekReportCreationParams = {
    companyId,
    objectId,
    periodType,
    year,
    ...(periodType === 'QUARTER' ? { quarter } : {}),
  };
  const ready = companyId > 0 && objectId > 0 && year > 0 && (periodType === 'YEAR' || quarter >= 1 && quarter <= 4);
  const context = useQuery({
    queryKey: pekKeys.creationContext(params),
    queryFn: ({ signal }) => pekApi.getReportCreationContext(params, signal),
    enabled: ready,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const assignees = useQuery({ queryKey: pekKeys.assignees(['PEK_RESPONSIBLE']), queryFn: ({ signal }) => pekApi.getAssignees(['PEK_RESPONSIBLE'], signal), retry: retryPekQuery });
  useEffect(() => {
    if (context.data?.selectedProgramId) setProgramId(context.data.selectedProgramId);
  }, [context.data?.selectedProgramId]);
  const create = useMutation({
    mutationFn: (request: PekReportCreateRequest) => pekApi.createReport(request),
    retry: false,
    onSuccess: async (report) => {
      client.setQueryData(pekKeys.report(report.id), report);
      await Promise.all([
        client.invalidateQueries({ queryKey: pekKeys.reports({ companyId, objectId }) }),
        client.invalidateQueries({ queryKey: pekKeys.dashboard() }),
      ]);
      toast.success('Отчёт ПЭК создан');
      navigate(`/staff/pek/reports/${report.id}`);
    },
    onError: (error) => {
      const mapped = mapPekError(error);
      toast.error(mapped.message);
      if (mapped.resourceId) navigate(`/staff/pek/reports/${mapped.resourceId}`);
    },
  });
  const availablePrograms = context.data?.programs || [];
  const selectedProgramId = programId || context.data?.selectedProgramId || (availablePrograms.length === 1 ? availablePrograms[0].id : 0);
  const blocked = Boolean(
    !context.data
    || context.data.blockingReasons.length
    || context.data.duplicateReportId
    || !selectedProgramId,
  );

  return <div className="space-y-5">
    <PekPageHeader title="Создание отчёта ПЭК" description="Период вычисляет backend; даты нельзя редактировать вручную" />
    <section className="grid gap-4 rounded-2xl border bg-white p-5 md:grid-cols-3">
      <PekCompanyObjectFilters
        companyId={companyId || undefined}
        objectId={objectId || undefined}
        onCompanyChange={(value) => setCompanyId(Number(value) || 0)}
        onObjectChange={(value) => setObjectId(Number(value) || 0)}
        required
      />
      <label>Тип периода<select value={periodType} onChange={(event) => setPeriodType(event.target.value as PekPeriodType)} className={inputClass}><option value="QUARTER">Квартал</option><option value="YEAR">Год</option></select></label>
      <label>Год<input type="number" min={2000} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} className={inputClass} /></label>
      {periodType === 'QUARTER' && <label>Квартал<select value={quarter} onChange={(event) => setQuarter(Number(event.target.value))} className={inputClass}>{[1, 2, 3, 4].map((value) => <option key={value}>{value}</option>)}</select></label>}
    </section>
    {!ready
      ? <PekState title="Выберите компанию, объект и период" />
      : context.isLoading
        ? <PekLoading />
        : context.isError
          ? <PekQueryError error={context.error} resource="Контекст создания отчёта" retry={() => void context.refetch()} />
          : context.data && <section className="space-y-4 rounded-2xl border bg-white p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <Summary label="Компания" value={context.data.company?.name || '—'} />
              <Summary label="Объект" value={context.data.object?.name || '—'} />
              <Summary label="Начало периода" value={context.data.periodStart} />
              <Summary label="Окончание периода" value={context.data.periodEnd} />
            </div>
            {availablePrograms.length > 0 && <label>Программа<select value={selectedProgramId} onChange={(event) => setProgramId(Number(event.target.value))} className={inputClass}><option value={0}>Выберите программу</option>{availablePrograms.map((program) => <option key={program.id} value={program.id}>{program.number} · {program.name}</option>)}</select></label>}
            {!availablePrograms.length && <PekState title="Подходящих программ нет" />}
            {context.data.warnings.map((warning) => <p key={warning} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>)}
            {context.data.blockingReasons.map((reason) => <p key={reason} className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{reason}</p>)}
            {context.data.duplicateReportId && <p className="rounded-xl bg-amber-50 p-3 text-sm">Отчёт за период уже существует. <Link className="font-bold underline" to={`/staff/pek/reports/${context.data.duplicateReportId}`}>Открыть отчёт №{context.data.duplicateReportId}</Link></p>}
            <PekLookupSelect label="Ответственный" required value={responsibleUserId} options={assignees.data || []} loading={assignees.isLoading} error={assignees.isError} onRetry={() => void assignees.refetch()} onChange={setResponsibleUserId} />
            <label className="flex items-center gap-2"><input type="checkbox" checked={collectImmediately} onChange={(event) => setCollectImmediately(event.target.checked)} />Сразу собрать подходящие протоколы</label>
            <Button disabled={blocked || !responsibleUserId || create.isPending} aria-busy={create.isPending} onClick={() => create.mutate(mapReportCreateRequest(params, selectedProgramId, collectImmediately, responsibleUserId || undefined))}>
              {create.isPending ? 'Создание…' : 'Создать отчёт'}
            </Button>
          </section>}
  </div>;
};

const Summary = ({ label, value }: { label: string; value: string }) => <div className="rounded-xl bg-slate-50 p-3"><span className="text-sm text-slate-500">{label}</span><p className="font-bold">{value}</p></div>;

export default PekReportCreatePage;
