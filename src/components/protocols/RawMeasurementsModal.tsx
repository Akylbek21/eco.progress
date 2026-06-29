import { useEffect, useMemo, useState } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import protocolService from '../../services/protocolService';
import type {
  ProtocolMeasurementDevice,
  ProtocolResultRow,
  RawMeasurementRequest,
  RawMeasurementsResponse,
} from '../../types/protocols';

type Props = {
  open: boolean;
  protocolId: string;
  row: ProtocolResultRow | null;
  devices?: ProtocolMeasurementDevice[];
  onClose: () => void;
  onCalculated: (row?: ProtocolResultRow) => void | Promise<void>;
  onReload?: () => void | Promise<void>;
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
};

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';

const valueOf = (row: ProtocolResultRow | null, keys: string[]) => {
  if (!row) return '';
  for (const key of keys) {
    const value = row.values[key];
    if (value !== undefined && value !== null && String(value) !== '') return String(value);
  }
  return '';
};

const indicator = (row: ProtocolResultRow | null) =>
  row?.pollutant?.name || row?.indicatorName || row?.indicator || valueOf(row, ['indicator', 'substanceName']) || 'Показатель';

const testingMethod = (row: ProtocolResultRow | null) =>
  row?.testingMethodDocument || row?.testingMethod || valueOf(row, ['testingMethodDocument', 'testingMethod']) || '';

const RawMeasurementsModal = ({
  open,
  protocolId,
  row,
  devices = [],
  onClose,
  onCalculated,
  onReload,
  onNotify,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<RawMeasurementsResponse | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [deviceId, setDeviceId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !row) return;
    let active = true;
    setLoading(true);
    setError('');
    protocolService.getRawMeasurements(protocolId, row.id)
      .then((response) => {
        if (!active) return;
        setData(response);
        const nextValues: Record<string, string> = {};
        response.variables.forEach((variable) => {
          const measurement = response.measurements.find((item) => item.variableKey === variable.variableKey);
          nextValues[variable.variableKey] = String(measurement?.variableValue ?? variable.defaultValue ?? '');
        });
        setValues(nextValues);
        setDeviceId(String(
          response.measurements.find((item) => item.deviceId)?.deviceId
          || row.measurementDeviceId
          || row.deviceId
          || valueOf(row, ['measurementDeviceId', 'deviceId', 'device'])
          || '',
        ));
      })
      .catch((loadError) => {
        if (!active) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить исходные данные');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, protocolId, row]);

  const missing = useMemo(() => (data?.variables || [])
    .filter((variable) => variable.required && !String(values[variable.variableKey] ?? '').trim())
    .map((variable) => variable.variableLabel || variable.variableKey), [data, values]);

  const payload = (): RawMeasurementRequest[] => (data?.variables || []).map((variable) => ({
    variableKey: variable.variableKey,
    variableValue: values[variable.variableKey] ?? '',
    unit: variable.unit,
    sourceType: 'MANUAL',
    deviceId,
  }));

  const save = async (calculate = false) => {
    if (!row || !data) return;
    if (missing.length) {
      setError(`Не заполнено: ${missing.join(', ')}`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await protocolService.saveRawMeasurements(protocolId, row.id, payload(), data.methodTemplate?.id);
      if (!calculate) {
        onNotify('Исходные данные сохранены', 'success');
        await onReload?.();
        onClose();
        return;
      }
      await protocolService.calculateResult(protocolId, row.id);
      onClose();
      await onReload?.();
      await onCalculated();
      onNotify('Результат рассчитан', 'success');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Не удалось сохранить исходные данные';
      setError(message);
      onNotify(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ввести исходные данные"
      description="Введите только исходные данные. Система рассчитает результат автоматически."
      size="lg"
      loading={loading || saving}
    >
      {row && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-900">{indicator(row)}</p>
            <p className="mt-1 text-sm text-slate-600">{data?.methodTemplate?.methodDocument || testingMethod(row) || 'Методика расчета не настроена. Можно ввести результат вручную.'}</p>
          </div>

          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

          {!loading && !data?.variables.length && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              Методика расчета не настроена. Можно ввести результат вручную.
            </div>
          )}

          {Boolean(data?.variables.length) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {data?.variables.map((variable) => (
                <label key={variable.variableKey} className="space-y-1.5 text-sm font-bold text-slate-700">
                  <span>{variable.variableLabel || variable.variableKey}{variable.required ? ' *' : ''}</span>
                  <div className="flex gap-2">
                    <input
                      type={variable.type === 'number' ? 'number' : 'text'}
                      value={values[variable.variableKey] || ''}
                      min={variable.minValue ?? undefined}
                      max={variable.maxValue ?? undefined}
                      onChange={(event) => setValues((current) => ({ ...current, [variable.variableKey]: event.target.value }))}
                      className={inputClass}
                    />
                    {variable.unit && <span className="inline-flex min-w-20 items-center justify-center rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-600">{variable.unit}</span>}
                  </div>
                  {(variable.minValue !== undefined || variable.maxValue !== undefined) && (
                    <p className="text-xs font-medium text-slate-500">
                      {variable.minValue !== undefined && variable.minValue !== null ? `от ${variable.minValue}` : ''}
                      {variable.maxValue !== undefined && variable.maxValue !== null ? ` до ${variable.maxValue}` : ''}
                    </p>
                  )}
                </label>
              ))}
              <label className="space-y-1.5 text-sm font-bold text-slate-700">
                <span>Прибор</span>
                <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)} className={inputClass}>
                  <option value="">Не выбран</option>
                  {devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>{device.deviceSnapshot.name} · {device.deviceSnapshot.serialNumber}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Отмена</Button>
            <Button type="button" variant="secondary" onClick={() => save(false)} disabled={saving || loading || !data?.variables.length}>Сохранить</Button>
            <Button type="button" onClick={() => save(true)} disabled={saving || loading || !data?.variables.length}>Сохранить и рассчитать</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default RawMeasurementsModal;
