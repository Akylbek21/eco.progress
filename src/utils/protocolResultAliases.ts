type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};

const scalar = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const normalized = String(value);
    if (normalized.trim()) return normalized;
  }
  return '';
};

const measurementDeviceId = (source: UnknownRecord, values: UnknownRecord) => {
  const measurementDevice = asRecord(source.measurementDevice);
  const device = asRecord(source.device);
  return scalar(
    source.measurementDeviceId,
    source.deviceId,
    measurementDevice.id,
    device.id,
    typeof source.device === 'string' || typeof source.device === 'number' ? source.device : undefined,
    values.measurementDeviceId,
    values.deviceId,
    values.device,
  );
};

export const resolveMeasurementDeviceId = (raw: unknown): string => {
  const source = asRecord(raw);
  return measurementDeviceId(source, asRecord(source.values));
};

export const canonicalProtocolResultAliases = (source: UnknownRecord, values: UnknownRecord) => ({
  indicatorName: scalar(source.indicatorName, values.indicatorName, values.indicator),
  code: scalar(source.code, source.pollutantCode, source.factorCode, values.code, values.pollutantCode, values.factorCode),
  result: scalar(source.result, source.resultValue, source.primaryReading, values.result, values.resultValue, values.resultMg, values.primaryReading),
  normative: scalar(source.normative, source.normativeValue, values.normative, values.normativeValue, values.pdk),
  testingMethodDocument: scalar(source.testingMethodNd, source.testingMethodDocument, source.testingMethod, values.testingMethodNd, values.testingMethodDocument, values.testingMethod),
  samplingMethodDocument: scalar(source.samplingMethodNd, source.samplingMethodDocument, source.samplingMethod, values.samplingMethodNd, values.samplingMethodDocument, values.samplingMethod),
  measurementDeviceId: measurementDeviceId(source, values),
});
