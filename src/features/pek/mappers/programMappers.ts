import type {
  PekControlItem,
  PekIndicator,
  PekMeasure,
  PekProgram,
  PekProgramCreateRequest,
  PekProgramForm,
  PekProgramUpdateRequest,
} from '../api/pekContracts';

const withoutClientFields = <T extends { clientId?: string }>(row: T) => {
  const { clientId: _clientId, ...result } = row;
  return result;
};

const mapControlItems = (rows: PekControlItem[]) => rows.map(withoutClientFields);
const mapMeasures = (rows: PekMeasure[]) => rows.map(withoutClientFields);

const mapIndicators = (form: PekProgramForm) => form.indicators.map((indicator) => {
  const {
    clientId: _clientId,
    controlItemClientId,
    controlItemIndex: existingIndex,
    ...result
  } = indicator;
  if (result.controlItemId) return result;
  const controlItemIndex = controlItemClientId
    ? form.controlItems.findIndex((item) => item.clientId === controlItemClientId)
    : existingIndex;
  return {
    ...result,
    controlItemIndex: controlItemIndex !== undefined && controlItemIndex >= 0
      ? controlItemIndex
      : undefined,
  };
});

const header = (form: PekProgramForm) => ({
  companyId: form.companyId,
  objectId: form.objectId,
  number: form.number.trim(),
  name: form.name.trim(),
  description: form.description?.trim() || null,
  validFrom: form.validFrom,
  validUntil: form.validUntil,
  responsibleUserId: form.responsibleUserId || null,
});

export const mapProgramCreateFormToRequest = (form: PekProgramForm): PekProgramCreateRequest => ({
  ...header(form),
  controlItems: mapControlItems(form.controlItems),
  indicators: mapIndicators(form),
  measures: mapMeasures(form.measures),
});

export const mapProgramEditFormToRequest = (
  form: PekProgramForm,
  changedCollections: ReadonlySet<'controlItems' | 'indicators' | 'measures'> = new Set([
    'controlItems',
    'indicators',
    'measures',
  ]),
): PekProgramUpdateRequest => ({
  version: form.version,
  name: form.name.trim(),
  description: form.description?.trim() || null,
  validFrom: form.validFrom,
  validUntil: form.validUntil,
  responsibleUserId: form.responsibleUserId || null,
  controlItems: changedCollections.has('controlItems') ? mapControlItems(form.controlItems) : undefined,
  indicators: changedCollections.has('indicators') ? mapIndicators(form) : undefined,
  measures: changedCollections.has('measures') ? mapMeasures(form.measures) : undefined,
});

export const mapProgramAutosaveToRequest = (form: PekProgramForm): PekProgramUpdateRequest => ({
  version: form.version,
  name: form.name.trim(),
  description: form.description?.trim() || null,
  validFrom: form.validFrom,
  validUntil: form.validUntil,
  responsibleUserId: form.responsibleUserId || null,
  // Undefined is intentional: backend treats [] as a command to clear a collection.
  controlItems: undefined,
  indicators: undefined,
  measures: undefined,
});

export const mapProgramToForm = (program: PekProgram): PekProgramForm => {
  const controls = (program.controlItems || []).map((item, index) => ({
    ...item,
    clientId: `control-${item.id ?? index}`,
  }));
  return {
    companyId: program.company?.id || 0,
    objectId: program.object?.id || 0,
    number: program.number,
    name: program.name,
    description: program.description || '',
    validFrom: program.validFrom,
    validUntil: program.validUntil,
    responsibleUserId: program.responsibleUserId || program.responsible?.id || null,
    version: program.version,
    controlItems: controls,
    indicators: (program.indicators || []).map((item, index) => ({
      ...item,
      clientId: `indicator-${item.id ?? index}`,
      controlItemClientId: item.controlItemId
        ? controls.find((control) => control.id === item.controlItemId)?.clientId
        : item.controlItemIndex !== undefined
          ? controls[item.controlItemIndex]?.clientId
          : undefined,
    })),
    measures: (program.measures || []).map((item, index) => ({
      ...item,
      clientId: `measure-${item.id ?? index}`,
    })),
  };
};
