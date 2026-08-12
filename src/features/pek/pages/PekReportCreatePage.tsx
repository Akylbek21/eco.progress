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
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState } from '../components/common/PekUi';
import { mapReportCreateRequest } from '../mappers/reportMappers';
import { mapPekError } from '../utils/pekErrorMapper';
import { labelPekStatus } from '../utils/pekLabels';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';
import { currentQuarter } from '../utils/pekPeriod';
import { useAuth } from '../../../contexts/AuthContext';

const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2';

const PekReportCreatePage = () => {
  const { user } = useAuth();
  const [initial] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const client = useQueryClient();
  const [companyId, setCompanyId] = useState(Number(initial.get('companyId')) || 0);
  const [objectId, setObjectId] = useState(Number(initial.get('objectId')) || 0);
  const [periodType, setPeriodType] = useState<PekPeriodType>(initial.get('periodType') === 'YEAR' ? 'YEAR' : 'QUARTER');
  const [year, setYear] = useState(Number(initial.get('year')) || new Date().getFullYear());
  const [quarter, setQuarter] = useState(Number(initial.get('quarter')) || currentQuarter());
  const [programId, setProgramId] = useState(0);
  const [collectImmediately, setCollectImmediately] = useState(false);
  const params: PekReportCreationParams = {
    companyId,
    objectId,
    periodType,
    year,
    ...(periodType === 'QUARTER' ? { quarter } : {}),
  };
  const ready = companyId > 0 && objectId > 0 && year > 0 && (periodType === 'YEAR' || quarter >= 1 && quarter <= 4);
  const context = useQuery({
    queryKey: pekKeys.creationContext(params, user?.id),
    queryFn: ({ signal }) => pekApi.getReportCreationContext(params, signal),
    enabled: ready,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const programsInScope = useQuery({
    queryKey: pekKeys.programList({ companyId, objectId, page: 0, size: 20, sort: 'updatedAt,desc' }),
    queryFn: ({ signal }) => pekApi.getPrograms({ companyId, objectId, page: 0, size: 20, sort: 'updatedAt,desc' }, signal),
    enabled: ready && context.isSuccess && context.data.programs.length === 0,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  useEffect(() => {
    if (context.data?.selectedProgramId) setProgramId(context.data.selectedProgramId);
  }, [context.data?.selectedProgramId]);
  const create = useMutation({
    mutationFn: (request: PekReportCreateRequest) => pekApi.createReport(request),
    retry: false,
    onSuccess: async (report) => {
      client.setQueryData(pekKeys.report(report.id, report.companyId, user?.id), report);
      await Promise.all([
        client.invalidateQueries({ queryKey: pekKeys.reports({ companyId, objectId }, user?.id) }),
        client.invalidateQueries({ queryKey: pekKeys.dashboard({}, user?.id) }),
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
    <PekPageHeader title="Создание отчёта ПЭК" description="Выберите программу и отчётный период. Точные даты система определит автоматически." />
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
            {!availablePrograms.length && programsInScope.isLoading && <PekLoading />}
            {!availablePrograms.length && programsInScope.isError && (
              <PekQueryError error={programsInScope.error} resource="Программы выбранного объекта" retry={() => void programsInScope.refetch()} />
            )}
            {!availablePrograms.length && programsInScope.isSuccess && programsInScope.data.content.length === 0 && (
              <PekState title="Для выбранного объекта программ ПЭК нет" message="Проверьте выбранный объект или создайте программу ПЭК для него." />
            )}
            {!availablePrograms.length && programsInScope.isSuccess && programsInScope.data.content.length > 0 && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div>
                  <p className="font-bold text-amber-950">Программа найдена, но пока не подходит для отчёта</p>
                  <p className="mt-1 text-sm text-amber-900">Для создания отчёта backend требует статус «Действует» и период программы, полностью покрывающий отчётный период.</p>
                </div>
                {programsInScope.data.content.map((program) => (
                  <div key={program.id} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-950">{program.number} · {program.name}</p>
                      <p className="mt-1 text-sm text-slate-600">Статус: {labelPekStatus(program.status)} · Период: {program.validFrom} — {program.validUntil}</p>
                    </div>
                    <Link to={`/staff/pek/programs/${program.id}?companyId=${program.company?.id || companyId}`} className="shrink-0 rounded-full border border-amber-300 px-4 py-2 text-center text-sm font-bold text-amber-950">Открыть программу</Link>
                  </div>
                ))}
              </div>
            )}
            {context.data.warnings.map((warning) => <p key={warning} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>)}
            {context.data.blockingReasons.map((reason) => <p key={reason} className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{reason}</p>)}
            {context.data.duplicateReportId && <p className="rounded-xl bg-amber-50 p-3 text-sm">Отчёт за период уже существует. <Link className="font-bold underline" to={`/staff/pek/reports/${context.data.duplicateReportId}`}>Открыть отчёт №{context.data.duplicateReportId}</Link></p>}
            <label className="flex items-center gap-2"><input type="checkbox" checked={collectImmediately} onChange={(event) => setCollectImmediately(event.target.checked)} />Сразу собрать подходящие протоколы</label>
            <PekState title="Ответственный будет назначен автоматически" message="После создания назначение отобразится в рабочей области отчёта." />
            <Button disabled={blocked || create.isPending} aria-busy={create.isPending} onClick={() => create.mutate(mapReportCreateRequest(params, selectedProgramId, collectImmediately))}>
              {create.isPending ? 'Создание…' : 'Создать отчёт'}
            </Button>
          </section>}
  </div>;
};

const Summary = ({ label, value }: { label: string; value: string }) => <div className="rounded-xl bg-slate-50 p-3"><span className="text-sm text-slate-500">{label}</span><p className="font-bold">{value}</p></div>;

export default PekReportCreatePage;
