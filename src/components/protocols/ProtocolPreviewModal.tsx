import Button from '../ui/Button';
import Modal from '../ui/Modal';

type Props = {
  open: boolean;
  loading?: boolean;
  previewUrl?: string;
  draft?: boolean;
  onClose: () => void;
};

const ProtocolPreviewModal = ({ open, loading = false, previewUrl, draft = false, onClose }: Props) => (
  <Modal open={open} onClose={onClose} title="Предпросмотр протокола" size="xl">
    <div className="relative min-h-[68vh] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      {draft && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="-rotate-12 text-6xl font-black uppercase tracking-[0.25em] text-slate-300/70">Черновик</span>
        </div>
      )}
      {loading && <div className="flex h-[68vh] items-center justify-center text-sm font-semibold text-slate-500">Загрузка предпросмотра...</div>}
      {!loading && previewUrl && <iframe src={previewUrl} title="Предпросмотр протокола" className="h-[68vh] w-full bg-white" />}
      {!loading && !previewUrl && <div className="flex h-[68vh] items-center justify-center text-sm font-semibold text-slate-500">Предпросмотр недоступен</div>}
    </div>
    <div className="mt-4 flex justify-end">
      <Button type="button" variant="secondary" onClick={onClose}>Закрыть</Button>
    </div>
  </Modal>
);

export default ProtocolPreviewModal;
