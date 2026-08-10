import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';
import protocolService from '../../../services/protocolService';
import type { ProtocolWizardForm } from '../components/wizardTypes';

type AutomaticField = 'temperature' | 'humidity' | 'pressure' | 'windSpeed';

type Params = {
  enabled: boolean;
  objectId: string;
  coordinates?: string;
  date: string;
  time: string;
  form: UseFormReturn<ProtocolWizardForm>;
};

export const useProtocolEnvironmentConditions = ({
  enabled,
  objectId,
  coordinates,
  date,
  time,
  form,
}: Params) => {
  const automaticValues = useRef<Partial<Record<AutomaticField, string>>>({});
  const query = useQuery({
    queryKey: ['protocol-weather', objectId, coordinates ?? '', date, time],
    queryFn: ({ signal }) => protocolService.getWeatherConditions({
      objectId,
      coordinates,
      date,
      time: time || '12:00',
      signal,
    }),
    enabled: enabled && Boolean(objectId && coordinates && date),
    retry: false,
  });

  useEffect(() => {
    const weather = query.data;
    if (!weather?.available || weather.status !== 'LOADED') return;

    const nextValues: Record<AutomaticField, string> = {
      temperature: weather.temperature == null ? '' : String(weather.temperature),
      humidity: weather.humidity == null ? '' : String(weather.humidity),
      pressure: weather.pressureKpa == null && weather.pressure == null
        ? ''
        : String(weather.pressureKpa ?? weather.pressure),
      windSpeed: weather.windSpeed == null ? '' : String(weather.windSpeed),
    };

    (Object.entries(nextValues) as Array<[AutomaticField, string]>).forEach(([field, nextValue]) => {
      if (!nextValue) return;
      const current = form.getValues(field);
      if (!current || current === automaticValues.current[field]) {
        form.setValue(field, nextValue, { shouldDirty: false });
      }
      automaticValues.current[field] = nextValue;
    });
    form.setValue('environmentSource', weather.source || 'API', { shouldDirty: false });
    form.setValue('environmentDataSource', weather.dataSource || '', { shouldDirty: false });
    form.setValue('environmentObservedAt', weather.observedAt || weather.weatherObservedAt || '', { shouldDirty: false });
  }, [form, query.data]);

  const message = !objectId
    ? ''
    : !coordinates
      ? 'У выбранного объекта не указаны координаты. Заполните условия среды вручную.'
      : query.isError
        ? 'Не удалось получить погодные данные. Заполните условия среды вручную.'
        : query.data?.warning
          ? query.data.warning
          : query.data?.available && query.data.status === 'LOADED'
            ? `Условия загружены автоматически${query.data.dataSource ? ` · ${query.data.dataSource}` : ''}.`
            : query.data
              ? 'Погодные данные недоступны. Заполните условия среды вручную.'
              : '';

  return {
    loading: query.isFetching,
    message,
    refresh: query.refetch,
  };
};
