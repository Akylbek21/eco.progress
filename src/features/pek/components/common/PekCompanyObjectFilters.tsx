import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { useEffect, useMemo } from 'react';
import { usePekScope } from '../../hooks/usePekScope';

type Props = {
  companyId?: number;
  objectId?: number;
  onCompanyChange: (value: string) => void;
  onObjectChange?: (value: string) => void;
  required?: boolean;
  showObject?: boolean;
  companyDisabled?: boolean;
  objectDisabled?: boolean;
};

const noop = () => undefined;

const PekCompanyObjectFilters = ({
  companyId,
  objectId,
  onCompanyChange,
  onObjectChange = noop,
  required,
  showObject = true,
  companyDisabled,
  objectDisabled,
}: Props) => {
  const scope = usePekScope(companyId);
  const objects = scope.objects;
  const activeObjects = useMemo(
    () => (objects.data || []).filter((item) => item.status === 'ACTIVE' && Number(item.companyId) === companyId),
    [companyId, objects.data],
  );
  const selectedCompany = scope.companies.find((item) => item.id === companyId) ?? null;
  const selectedObject = activeObjects.find((item) => item.id === objectId) ?? null;

  useEffect(() => {
    if (!companyId && scope.companies.length === 1) onCompanyChange(String(scope.companies[0].id));
  }, [companyId, onCompanyChange, scope.companies]);

  useEffect(() => {
    if (!scope.availableCompanies.isSuccess || !companyId || scope.companyAllowed) return;
    onCompanyChange('');
    onObjectChange('');
  }, [companyId, onCompanyChange, onObjectChange, scope.availableCompanies.isSuccess, scope.companyAllowed]);

  useEffect(() => {
    if (!companyId || !objects.isSuccess) return;
    if (objectId && !activeObjects.some((item) => item.id === objectId)) {
      onObjectChange('');
      return;
    }
    if (!objectId && activeObjects.length === 1) onObjectChange(String(activeObjects[0].id));
  }, [activeObjects, companyId, objectId, objects.isSuccess, onObjectChange]);

  const companyHelper = scope.availableCompanies.isError
    ? 'Не удалось загрузить компании'
    : scope.availableCompanies.isSuccess && !scope.companies.length
      ? 'Нет доступных компаний'
      : undefined;
  const objectHelper = !companyId
    ? 'Сначала выберите компанию'
    : objects.isError
      ? 'Не удалось загрузить объекты'
      : objects.isSuccess && !activeObjects.length
        ? 'У выбранной компании нет активных объектов'
        : undefined;

  return <>
    <div className="min-w-0">
      <Autocomplete
        options={scope.companies}
        value={selectedCompany}
        loading={scope.availableCompanies.isLoading}
        disabled={companyDisabled}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        getOptionLabel={(option) => `${option.name}${option.bin ? ` · БИН ${option.bin}` : ''}`}
        loadingText="Загрузка компаний…"
        noOptionsText={scope.availableCompanies.isLoading ? 'Загрузка компаний…' : 'Нет доступных компаний'}
        onChange={(_, company) => {
          onCompanyChange(company ? String(company.id) : '');
          onObjectChange('');
        }}
        renderInput={(params) => <TextField
          {...params}
          label={`Компания${required ? ' *' : ''}`}
          error={scope.availableCompanies.isError}
          helperText={companyHelper}
          placeholder={scope.availableCompanies.isLoading ? 'Загрузка компаний…' : 'Выберите компанию'}
          InputProps={{
            ...params.InputProps,
            endAdornment: <>{scope.availableCompanies.isLoading && <CircularProgress color="inherit" size={18} />}{params.InputProps.endAdornment}</>,
          }}
        />}
      />
      {scope.availableCompanies.isError && <button type="button" onClick={() => void scope.availableCompanies.refetch()} className="mt-1 text-xs font-bold text-rose-700 underline">Повторить</button>}
    </div>

    {showObject && <div className="min-w-0">
      <Autocomplete
        key={`pek-object-company-${companyId || 'none'}`}
        options={activeObjects}
        value={selectedObject}
        loading={objects.isLoading}
        disabled={objectDisabled || !companyId || !scope.companyAllowed || objects.isError}
        isOptionEqualToValue={(option, value) => option.id === value.id && option.companyId === value.companyId}
        getOptionLabel={(option) => `${option.name}${option.address ? ` · ${option.address}` : ''}`}
        loadingText="Загрузка объектов…"
        noOptionsText={!companyId ? 'Сначала выберите компанию' : objects.isLoading ? 'Загрузка объектов…' : 'У выбранной компании нет активных объектов'}
        onChange={(_, object) => onObjectChange(object ? String(object.id) : '')}
        renderInput={(params) => <TextField
          {...params}
          label={`Объект${required ? ' *' : ''}`}
          error={objects.isError}
          helperText={objectHelper}
          placeholder={!companyId ? 'Сначала выберите компанию' : objects.isLoading ? 'Загрузка объектов…' : 'Выберите объект'}
          InputProps={{
            ...params.InputProps,
            endAdornment: <>{objects.isLoading && <CircularProgress color="inherit" size={18} />}{params.InputProps.endAdornment}</>,
          }}
        />}
      />
      {objects.isError && <button type="button" onClick={() => void objects.refetch()} className="mt-1 text-xs font-bold text-rose-700 underline">Повторить</button>}
    </div>}
  </>;
};

export default PekCompanyObjectFilters;
