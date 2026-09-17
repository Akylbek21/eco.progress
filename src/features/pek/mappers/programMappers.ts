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
    normativeDocument: _normativeDocument,
    normativeRevision: _normativeRevision,
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

const facilitySnapshot = (form: PekProgramForm) => ({
  facilityInformation: form.facilityInformation?.trim() || null,
  kato: form.kato?.trim() || null,
  binSnapshot: form.bin?.trim() || null,
  oked: form.oked?.trim() || null,
  environmentalCategory: form.environmentalCategory?.trim() || null,
  designCapacity: form.designCapacity?.trim() || null,
  designCapacityUnit: form.designCapacityUnit?.trim() || null,
  productionCharacteristics: form.productionCharacteristics?.trim() || null,
  monitoringScope: form.monitoringScope?.trim() || null,
  readinessNotes: form.readinessNotes?.trim() || null,
});

const mutableHeader = (form: PekProgramForm) => ({
  name: form.name.trim(),
  description: form.description?.trim() || null,
  validFrom: form.validFrom,
  validUntil: form.validUntil,
  responsibleUserId: form.responsibleUserId || null,
  facilitySnapshot: facilitySnapshot(form),
  permitIds: form.permitIds || [],
});

export const mapProgramCreateFormToRequest = (form: PekProgramForm): PekProgramCreateRequest => ({
  ...mutableHeader(form),
  companyId: form.companyId,
  objectId: form.objectId,
  number: form.number.trim(),
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
  ...mutableHeader(form),
  controlItems: changedCollections.has('controlItems') ? mapControlItems(form.controlItems) : undefined,
  indicators: changedCollections.has('indicators') ? mapIndicators(form) : undefined,
  measures: changedCollections.has('measures') ? mapMeasures(form.measures) : undefined,
});

export const mapProgramAutosaveToRequest = (form: PekProgramForm): PekProgramUpdateRequest => ({
  ...mutableHeader(form),
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
    regulationVersion: program.regulationVersion,
    templateVersion: program.templateVersion,
    contentRevision: program.contentRevision,
    facilityInformation: program.facilityInformation || '',
    kato: program.kato || '',
    bin: program.bin || '',
    oked: program.oked || '',
    environmentalCategory: program.environmentalCategory || '',
    designCapacity: program.designCapacity || '',
    designCapacityUnit: program.designCapacityUnit || '',
    productionCharacteristics: program.productionCharacteristics || '',
    monitoringScope: program.monitoringScope || '',
    permitIds: program.permitIds || [],
    readinessNotes: program.readinessNotes || '',
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

// PATCH responses may omit nullable snapshot fields. Preserve what the user
// submitted so a successful save cannot immediately blank those inputs.
export const mapSavedProgramToForm = (
  program: PekProgram,
  submitted: PekProgramForm,
): PekProgramForm => {
  const mapped = mapProgramToForm(program);
  return {
    ...mapped,
    name: submitted.name,
    description: submitted.description,
    validFrom: submitted.validFrom,
    validUntil: submitted.validUntil,
    responsibleUserId: submitted.responsibleUserId,
    facilityInformation: submitted.facilityInformation,
    kato: submitted.kato,
    bin: submitted.bin,
    oked: submitted.oked,
    environmentalCategory: submitted.environmentalCategory,
    designCapacity: submitted.designCapacity,
    designCapacityUnit: submitted.designCapacityUnit,
    productionCharacteristics: submitted.productionCharacteristics,
    monitoringScope: submitted.monitoringScope,
    permitIds: submitted.permitIds,
    readinessNotes: submitted.readinessNotes,
    controlItems: mapped.controlItems.length || !submitted.controlItems.length ? mapped.controlItems : submitted.controlItems,
    indicators: mapped.indicators.length || !submitted.indicators.length ? mapped.indicators : submitted.indicators,
    measures: mapped.measures.length || !submitted.measures.length ? mapped.measures : submitted.measures,
  };
};
