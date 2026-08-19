import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getLaboratories } from '../../laboratories/api/laboratoryService';
import type { PekSettingsUpdateRequest } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState } from '../components/common/PekUi';
import { parseApiError } from '../../../services/apiHelpers';
import { useAuth } from '../../../contexts/AuthContext';
import { usePekScope } from '../hooks/usePekScope';
import { mapPekError } from '../utils/pekErrorMapper';
import { retryPekQuery } from '../utils/pekQueryPolicy';
import { canManagePekSettings, canRunPekScheduler } from '../permissions/pekAccess';

const booleanFields: Array<[keyof PekSettingsUpdateRequest, string]> = [
  ['includeOnlySignedProtocols', 'Учитывать только подписанные протоколы'],
  ['allowFallbackMatching', 'Разрешить дополнительное автоматическое сопоставление'],
  ['requireManualAmbiguousConfirmation', 'Требовать ручное подтверждение неоднозначных результатов'],
  ['requireAllPlanFactItems', 'Требовать выполнение всего плана контроля'],
  ['blockSubmitWithUnmatchedResults', 'Блокировать отправку при несопоставленных результатах'],
  ['blockSubmitWithAmbiguousResults', 'Блокировать отправку при неоднозначных результатах'],
  ['blockSubmitWithStaleSources', 'Блокировать отправку при устаревших связях'],
  ['blockSubmitWithOpenExceedances', 'Блокировать отправку при открытых превышениях'],
  ['notifyMissingProtocols', 'Уведомлять об отсутствующих протоколах'],
  ['notifyExceedances', 'Уведомлять о превышениях'],
  ['notifyReportReturned', 'Уведомлять о возврате отчёта'],
];

const toRequest = (value: NonNullable<Awaited<ReturnType<typeof pekApi.getSettings>>>): PekSettingsUpdateRequest => {
  const { companyId: _companyId, defaultResponsibleUser: _user, defaultLaboratory: _laboratory, version: _version, ...request } = value;
  return request;
};

const PekSettingsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCompanyId = Number(searchParams.get('companyId')) || 0;
  const scope = usePekScope(selectedCompanyId || undefined);
  const settingsKey = pekKeys.settings(selectedCompanyId || null, user?.id);
  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: ({ signal }) => pekApi.getSettings(selectedCompanyId, signal),
    enabled: selectedCompanyId > 0 && scope.companyAllowed,
    retry: retryPekQuery,
  });
  const assignees = useQuery({ queryKey: pekKeys.assignees(['PEK_RESPONSIBLE'], user?.id), queryFn: ({ signal }) => pekApi.getAssignees(['PEK_RESPONSIBLE'], signal) });
  const laboratories = useQuery({ queryKey: ['laboratories', 'pek-settings', `user:${user?.id ?? 'anonymous'}`], queryFn: ({ signal }) => getLaboratories({ page: 0, size: 100, status: 'ACTIVE' }, signal) });
  const runScheduler = useMutation({
    mutationFn: () => pekApi.runSchedulerNow(selectedCompanyId),
    onSuccess: () => setMessage('Ручной запуск планировщика ПЭК запущен.'),
    onError: (error) => setMessage(mapPekError(error).message),
  });
  const [form, setForm] = useState<PekSettingsUpdateRequest | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (selectedCompanyId || scope.companies.length !== 1) return;
    setSearchParams({ companyId: String(scope.companies[0].id) }, { replace: true });
  }, [scope.companies, selectedCompanyId, setSearchParams]);
  useEffect(() => {
    if (!settings.data) return;
    setForm(toRequest(settings.data));
  }, [settings.data]);
  const save = useMutation({
    mutationFn: async (body: PekSettingsUpdateRequest) => {
      await pekApi.updateSettings(selectedCompanyId, settings.data!.version, body);
      const confirmed = await pekApi.getSettings(selectedCompanyId);
      if (JSON.stringify(toRequest(confirmed)) !== JSON.stringify(body)) {
        throw new Error('Сервер не подтвердил сохранение всех настроек ПЭК. Показаны актуальные серверные значения.');
      }
      return confirmed;
    },
    onSuccess: (confirmed) => {
      queryClient.setQueryData(settingsKey, confirmed);
      setMessage('Настройки ПЭК сохранены.');
    },
    onError: async (error) => {
      const mapped = mapPekError(error);
      const fields = Object.entries(mapped.fieldErrors).map(([field, value]) => `${field}: ${value}`).join('; ');
      setMessage(`${mapped.message || parseApiError(error, 'Не удалось сохранить настройки ПЭК.').message}${mapped.code ? ` (${mapped.code})` : ''}${fields ? `. ${fields}` : ''}`);
      await settings.refetch();
    },
  });
  const companyInput = <><TextField fullWidth type="number" label="Компания (PEK scope)" value={selectedCompanyId || ''} inputProps={{ min: 1, list: 'pek-settings-companies' }} onChange={(event) => { setForm(null); setMessage(null); setSearchParams(event.target.value ? { companyId: event.target.value } : {}, { replace: true }); }} /><datalist id="pek-settings-companies">{scope.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</datalist></>;
  if (!selectedCompanyId) return <div className="space-y-5"><PekPageHeader title="Настройки ПЭК" description="Выберите компанию, настройки которой нужно открыть" />{companyInput}<PekState title="Выберите компанию" message="Компании предлагаются из PEK scope backend; ID можно указать вручную для серверной проверки." /></div>;
  if (settings.isLoading) return <PekLoading />;
  if (settings.isError) return <PekQueryError error={settings.error} resource="настройки ПЭК" retry={() => void settings.refetch()} />;
  if (!settings.data || !form) return <PekState title="Настройки ПЭК не получены" message="Сервис не вернул данные настроек." />;
  const editable = canManagePekSettings(user);
  const canRunScheduler = canRunPekScheduler(user);
  const dirty = settings.data ? JSON.stringify(form) !== JSON.stringify(toRequest(settings.data)) : false;
  const set = <K extends keyof PekSettingsUpdateRequest>(key: K, value: PekSettingsUpdateRequest[K]) => setForm((current) => current ? { ...current, [key]: value } : current);
  return <div className="space-y-5">
    <PekPageHeader title="Настройки ПЭК" description="Правила сбора данных и проверки готовности отчётов" />
    {companyInput}
    {!editable && <Alert severity="info">Настройки доступны только для просмотра</Alert>}
    {message && <Alert severity={save.isError ? 'error' : 'success'}>{message}</Alert>}
    <section className="space-y-5 rounded-2xl border bg-white p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <TextField select label="Тип отчётного периода" value={form.defaultReportType} disabled={!editable} onChange={(event) => set('defaultReportType', event.target.value as 'QUARTERLY' | 'YEARLY')}><MenuItem value="QUARTERLY">Квартальный</MenuItem><MenuItem value="YEARLY">Годовой</MenuItem></TextField>
        <TextField select label="Ответственный по умолчанию" value={form.defaultResponsibleUserId ?? ''} disabled={!editable || assignees.isLoading} onChange={(event) => set('defaultResponsibleUserId', event.target.value ? Number(event.target.value) : null)}><MenuItem value="">Не выбран</MenuItem>{assignees.data?.map((user) => <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>)}</TextField>
        <TextField select label="Лаборатория по умолчанию" value={form.defaultLaboratoryId ?? ''} disabled={!editable || laboratories.isLoading} onChange={(event) => set('defaultLaboratoryId', event.target.value ? Number(event.target.value) : null)}><MenuItem value="">Не выбрана</MenuItem>{laboratories.data?.content.map((laboratory) => <MenuItem key={laboratory.id} value={laboratory.id}>{laboratory.name}</MenuItem>)}</TextField>
        <TextField type="number" label="Уведомлять до срока, дней" value={form.notifyBeforeDeadlineDays} disabled={!editable} inputProps={{ min: 0, max: 365 }} onChange={(event) => set('notifyBeforeDeadlineDays', Number(event.target.value))} />
      </div>
      <FormControlLabel control={<Checkbox checked={form.autoCollectProtocols} disabled={!editable} onChange={(event) => set('autoCollectProtocols', event.target.checked)} />} label="Автоматически собирать протоколы" />
      <div className="grid gap-2 md:grid-cols-2">{booleanFields.map(([key, label]) => <FormControlLabel key={key} control={<Checkbox checked={Boolean(form[key])} disabled={!editable} onChange={(event) => set(key, event.target.checked)} />} label={label} />)}</div>
      {editable && <div className="flex justify-end gap-3"><Button variant="outlined" disabled={!dirty || save.isPending} onClick={() => settings.data && setForm(toRequest(settings.data))}>Сбросить</Button><Button variant="contained" disabled={!dirty || save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? 'Сохранение…' : 'Сохранить'}</Button></div>}
    </section>
    <section className="space-y-4 rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">Автоматизация</h2><p className="text-sm text-slate-500">Параметры берутся из настроек ПЭК выбранной компании.</p></div>{canRunScheduler && <Button variant="contained" disabled={runScheduler.isPending} onClick={() => runScheduler.mutate()}>{runScheduler.isPending ? 'Запуск…' : 'Запустить сейчас'}</Button>}</div>
      <p className="text-sm text-slate-600">Автосбор протоколов: <strong>{settings.data.autoCollectProtocols ? 'включён' : 'выключен'}</strong>. Период отчёта: <strong>{settings.data.defaultReportType === 'YEARLY' ? 'год' : 'квартал'}</strong>.</p>
    </section>
  </div>;
};
export default PekSettingsPage;
