import Button from '../ui/Button';
import Modal from '../ui/Modal';

type Props = {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

const SignProtocolModal = ({ open, loading = false, onClose, onConfirm }: Props) => (
  <Modal open={open} onClose={onClose} title="Подписать протокол">
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
        После подписания протокол нельзя будет редактировать.
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Перед продолжением запустите NCALayer и подключите ключ ЭЦП. Если соединение недоступно, приложение подскажет проверить NCALayer и адрес локального WebSocket.
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
        <Button type="button" disabled={loading} onClick={onConfirm}>{loading ? 'Подписание...' : 'Подписать протокол'}</Button>
      </div>
    </div>
  </Modal>
);

export default SignProtocolModal;
