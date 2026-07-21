import Button from '../ui/Button';
import Modal from '../ui/Modal';
import type { Protocol } from '../../types/protocols';

type Props = {
  open: boolean;
  loading?: boolean;
  protocol?: Protocol;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

const SignProtocolModal = ({ open, loading = false, protocol, onClose, onConfirm }: Props) => {
  const expiredDevices = protocol?.measurementDevices.filter((item) => {
    const validUntil = item.deviceSnapshot.verificationValidUntil;
    return item.deviceSnapshot.status === 'EXPIRED' || item.deviceSnapshot.status === 'ARCHIVED' || Boolean(validUntil && validUntil < new Date().toISOString().slice(0, 10));
  }).length || 0;
  return (
  <Modal open={open} onClose={onClose} title="Подписать протокол">
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
        После подписания протокол нельзя будет редактировать.
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Перед продолжением запустите NCALayer и подключите ключ ЭЦП. Если соединение недоступно, приложение подскажет проверить NCALayer и адрес локального WebSocket.
      </div>
      {protocol && (
        <dl className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Номер</dt><dd className="font-semibold">{protocol.protocolNumber || protocol.number}</dd></div>
          <div><dt className="text-slate-500">Лаборатория</dt><dd className="font-semibold">{protocol.laboratory.laboratoryName || '—'}</dd></div>
          <div><dt className="text-slate-500">Подписант</dt><dd className="font-semibold">{protocol.laboratory.laboratoryHead || protocol.approver || '—'}</dd></div>
          <div><dt className="text-slate-500">Аттестат до</dt><dd className="font-semibold">{protocol.laboratory.accreditationValidUntil || '—'}</dd></div>
          <div><dt className="text-slate-500">Приборы</dt><dd className="font-semibold">{protocol.measurementDevices.length}</dd></div>
          <div><dt className="text-slate-500">Просроченные приборы</dt><dd className={expiredDevices ? 'font-semibold text-rose-700' : 'font-semibold text-emerald-700'}>{expiredDevices}</dd></div>
        </dl>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
        <Button type="button" disabled={loading || expiredDevices > 0} onClick={onConfirm}>{loading ? 'Подписание...' : 'Подписать протокол'}</Button>
      </div>
    </div>
  </Modal>
  );
};

export default SignProtocolModal;
