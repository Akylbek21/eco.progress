import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

type FormValues = { reason: string };
type Props = { open: boolean; loading?: boolean; onClose: () => void; onConfirm: (reason: string) => void | Promise<void> };

const ReturnForRevisionModal = ({ open, loading = false, onClose, onConfirm }: Props) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ defaultValues: { reason: '' } });
  useEffect(() => { if (open) reset({ reason: '' }); }, [open, reset]);
  return (
    <Modal open={open} onClose={onClose} title="Вернуть протокол на доработку">
      <form className="space-y-5" onSubmit={handleSubmit(({ reason }) => onConfirm(reason.trim()))}>
        <label className="block text-sm font-semibold text-slate-700">
          Причина возврата <span aria-hidden="true" className="text-rose-600">*</span>
          <textarea
            {...register('reason', { required: 'Укажите причину возврата', validate: (value) => value.trim().length >= 3 || 'Причина должна содержать не менее 3 символов' })}
            rows={4}
            disabled={loading}
            aria-invalid={Boolean(errors.reason)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100"
          />
        </label>
        {errors.reason && <p role="alert" className="text-sm text-rose-700">{errors.reason.message}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>Отменить</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Возврат...' : 'Вернуть на доработку'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ReturnForRevisionModal;
