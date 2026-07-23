import type { MeasurementDevice, Protocol, ProtocolMeasurementDevice } from '../types/protocols';

const selectableStatuses = new Set(['VALID', 'ACTIVE', 'EXPIRING']);

export const isDeviceValidForDate = (
  device: Pick<MeasurementDevice, 'status' | 'verificationValidUntil'>,
  measurementDate: string,
): boolean => {
  const status = String(device.status || '').trim().toUpperCase();
  if (!selectableStatuses.has(status)) return false;
  const validUntil = String(device.verificationValidUntil || '').slice(0, 10);
  return !validUntil || !measurementDate || validUntil >= measurementDate.slice(0, 10);
};

export const collectProtocolDevices = (protocol: Protocol): ProtocolMeasurementDevice[] => {
  const instruments = (protocol.instruments || []).map((device) => ({
    id: String(device.id),
    protocolId: protocol.id,
    deviceId: String(device.id),
    deviceSnapshot: {
      name: device.name,
      model: device.model,
      serialNumber: device.serialNumber,
      verificationCertificateNumber: device.verificationCertificateNumber,
      verificationDate: device.verificationDate,
      verificationValidUntil: device.verificationValidUntil,
      units: device.units,
      status: device.status,
    },
  } satisfies ProtocolMeasurementDevice));
  const devices = [...(protocol.measurementDevices || []), ...instruments];
  const seen = new Set(devices.map((item) => String(item.deviceId || item.id)));

  for (const row of protocol.results || []) {
    const snapshot = row.deviceSnapshot || row.measurementDevice || row.device;
    const deviceId = String(row.measurementDeviceId || row.deviceId || snapshot?.id || '').trim();
    if (!deviceId || seen.has(deviceId)) continue;
    devices.push({
      id: deviceId,
      protocolId: protocol.id,
      deviceId,
      deviceSnapshot: {
        name: String(snapshot?.name || row.deviceName || ''),
        model: String(snapshot?.model || ''),
        serialNumber: String(snapshot?.serialNumber || ''),
        verificationCertificateNumber: String(snapshot?.verificationNumber || ''),
        verificationDate: '',
        verificationValidUntil: String(snapshot?.verificationValidUntil || ''),
        units: '',
        status: 'VALID',
      },
    });
    seen.add(deviceId);
  }

  return devices.filter((item, index, items) => {
    const key = String(item.deviceId || item.id) || `${item.deviceSnapshot.name}:${item.deviceSnapshot.serialNumber}`;
    return items.findIndex((candidate) => {
      const candidateKey = String(candidate.deviceId || candidate.id) || `${candidate.deviceSnapshot.name}:${candidate.deviceSnapshot.serialNumber}`;
      return candidateKey === key;
    }) === index;
  });
};
