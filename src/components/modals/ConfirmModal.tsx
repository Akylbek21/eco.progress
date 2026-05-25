import Modal from '../ui/Modal';
import Button from '../ui/Button';

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger' | 'success';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

const ConfirmModal = ({
  isOpen,
  title,
  description,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  variant = 'default',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    description={description}
    size="sm"
    loading={loading}
    footer={(
      <>
        <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>{cancelText}</Button>
        <Button
          type="button"
          disabled={loading}
          onClick={onConfirm}
          className={variant === 'danger' ? 'bg-rose-600 text-white hover:bg-rose-700' : variant === 'success' ? 'bg-eco-600 text-white hover:bg-eco-700' : undefined}
        >
          {confirmText}
        </Button>
      </>
    )}
  >
    <div className="text-sm leading-6 text-slate-600">
      {description ? 'Проверьте действие перед подтверждением.' : 'Это действие будет выполнено после подтверждения.'}
    </div>
  </Modal>
);

export default ConfirmModal;
