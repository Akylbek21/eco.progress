import type { MeasurementDevice } from '../../../../types/protocols';
import { isDeviceValidForDate } from '../../../../utils/protocolDevices';

type Props = { value: string; devices: MeasurementDevice[]; measurementDate: string; laboratoryId: string; onChange: (value: string) => void; error?: boolean };
const DeviceSelector = ({ value, devices, measurementDate, laboratoryId, onChange, error }: Props) => { const available = devices.filter((device) => isDeviceValidForDate(device, measurementDate) && (!device.laboratoryId || String(device.laboratoryId) === laboratoryId)); return <select aria-label="Прибор" aria-invalid={error || undefined} value={value} onChange={(event) => onChange(event.target.value)} className={`min-w-64 rounded-lg border px-2 py-2 text-xs ${error ? 'border-rose-400 bg-rose-50' : 'border-slate-200'}`}><option value="">Выберите прибор</option>{available.map((device) => <option key={device.id} value={device.id}>{device.name} · {device.model || 'без модели'} · №{device.serialNumber || '—'} · поверка до {device.verificationValidUntil || '—'} · {device.status}</option>)}</select>; };
export default DeviceSelector;
