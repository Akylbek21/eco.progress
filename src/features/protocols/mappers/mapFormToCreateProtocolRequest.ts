import type { CreateProtocolPayload } from '../../../types/protocols';
import { normalizeProtocolPrintVisibility } from '../../../utils/protocolPrintVisibility';
import { mapFrontendProtocolType } from '../api/protocolTypeMapper';

const id = (value: string | number | undefined) => {
  if (value === undefined || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const decimal = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value).trim().replace(',', '.');
};

/** Canonical mapper for POST /api/protocols. It intentionally does not share the quick-create conditions contract. */
export const mapFormToCreateProtocolRequest = (form: CreateProtocolPayload) => {
  const sampleDate = form.sampleDate || form.measurementDate;
  return {
    templateId: mapFrontendProtocolType(form.templateId),
    companyId: id(form.companyId),
    objectId: id(form.objectId),
    protocolNumber: form.protocolNumber || undefined,
    protocolDate: form.protocolDate,
    sampleDate: sampleDate || undefined,
    testingStartDate: form.testingStartDate || undefined,
    testingEndDate: form.testingEndDate || undefined,
    purpose: form.purpose || undefined,
    productName: form.productName || undefined,
    testingBasis: form.testingBasis || undefined,
    productNormativeDocument: form.productNormativeDocument || undefined,
    samplingMethodDocument: form.samplingMethodDocument || undefined,
    testingMethodDocument: form.testingMethodDocument || undefined,
    subtype: form.subtype || undefined,
    formCode: form.formCode || undefined,
    appendixNumber: form.appendixNumber || undefined,
    measurementDate: form.measurementDate || sampleDate || undefined,
    measurementTime: form.measurementTime || undefined,
    measurementPlace: form.measurementPlace || undefined,
    sourceNumber: form.sourceNumber || undefined,
    laboratoryId: id(form.laboratoryId),
    executorId: id(form.executorId),
    environment: form.environment ? {
      temperatureC: decimal(form.environment.temperature),
      temperatureMinC: decimal(form.environment.minTemperature),
      temperatureMaxC: decimal(form.environment.maxTemperature),
      humidityPercent: decimal(form.environment.humidity),
      humidityMinPercent: decimal(form.environment.minHumidity),
      humidityMaxPercent: decimal(form.environment.maxHumidity),
      pressureKpa: decimal(form.environment.pressureKpa ?? form.environment.pressure),
      pressureHpa: decimal(form.environment.pressureHpa),
      windSpeedMs: decimal(form.environment.windSpeed),
      conditionsComment: form.environment.comment || undefined,
      source: form.environment.source || undefined,
      dataSource: form.environment.dataSource || undefined,
      observedAt: form.environment.observedAt || undefined,
      loadedAt: form.environment.loadedAt || undefined,
      manualChangeReason: form.environment.manualChangeReason || undefined,
    } : undefined,
    printVisibility: normalizeProtocolPrintVisibility(form.printVisibility),
  };
};
