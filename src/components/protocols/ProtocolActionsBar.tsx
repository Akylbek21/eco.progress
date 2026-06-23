import { Ban, CheckCircle2, Download, Eye, FileDown, FileText, RotateCcw, Save, SearchCheck, Signature, Trash2, Undo2 } from 'lucide-react';
import Button from '../ui/Button';
import type { ProtocolStatus } from '../../types/protocols';

type Props = {
  status: ProtocolStatus;
  busy?: boolean;
  canApprove?: boolean;
  onSave: () => void | Promise<void>;
  onPreview: () => void | Promise<void>;
  onCheckNormatives: () => void | Promise<void>;
  onReady: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onApprove: () => void | Promise<void>;
  onReturnDraft: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  onGeneratePdf: () => void | Promise<void>;
  onGenerateDocx: () => void | Promise<void>;
  onSign: () => void;
  onDownloadPdf: () => void | Promise<void>;
  onDownloadDocx: () => void | Promise<void>;
  onReplace: () => void;
  onOpenReplacement?: () => void;
};

const ProtocolActionsBar = ({
  status,
  busy = false,
  canApprove = false,
  onSave,
  onPreview,
  onCheckNormatives,
  onReady,
  onDelete,
  onApprove,
  onReturnDraft,
  onCancel,
  onGeneratePdf,
  onGenerateDocx,
  onSign,
  onDownloadPdf,
  onDownloadDocx,
  onReplace,
  onOpenReplacement,
}: Props) => {
  const buttonClass = 'shrink-0';

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:-mx-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {status === 'DRAFT' && (
          <>
            <Button className={buttonClass} disabled={busy} onClick={onSave}><Save className="h-4 w-4" /> Сохранить</Button>
            <Button className={buttonClass} variant="secondary" disabled={busy} onClick={onPreview}><Eye className="h-4 w-4" /> Предпросмотр</Button>
            <Button className={buttonClass} variant="secondary" disabled={busy} onClick={onCheckNormatives}><SearchCheck className="h-4 w-4" /> Проверить нормативы</Button>
            <Button className={buttonClass} disabled={busy} onClick={onReady}><CheckCircle2 className="h-4 w-4" /> Готов к утверждению</Button>
            <Button className={`${buttonClass} text-rose-700 hover:bg-rose-50`} variant="secondary" disabled={busy} onClick={onDelete}><Trash2 className="h-4 w-4" /> Удалить</Button>
          </>
        )}
        {status === 'READY_FOR_APPROVAL' && (
          <>
            <Button className={buttonClass} variant="secondary" disabled={busy} onClick={onPreview}><Eye className="h-4 w-4" /> Предпросмотр</Button>
            {canApprove && <Button className={buttonClass} disabled={busy} onClick={onApprove}><CheckCircle2 className="h-4 w-4" /> Утвердить</Button>}
            {canApprove && <Button className={buttonClass} variant="secondary" disabled={busy} onClick={onReturnDraft}><Undo2 className="h-4 w-4" /> Вернуть в черновик</Button>}
            <Button className={`${buttonClass} text-rose-700 hover:bg-rose-50`} variant="secondary" disabled={busy} onClick={onCancel}><Ban className="h-4 w-4" /> Отменить</Button>
          </>
        )}
        {status === 'APPROVED' && (
          <>
            <Button className={buttonClass} variant="secondary" disabled={busy} onClick={onGeneratePdf}><FileDown className="h-4 w-4" /> PDF</Button>
            <Button className={buttonClass} variant="secondary" disabled={busy} onClick={onGenerateDocx}><FileText className="h-4 w-4" /> DOCX</Button>
            <Button className={buttonClass} disabled={busy} onClick={onSign}><Signature className="h-4 w-4" /> Подписать</Button>
            <Button className={buttonClass} variant="secondary" disabled={busy} onClick={onDownloadPdf}><Download className="h-4 w-4" /> Скачать PDF</Button>
            <Button className={buttonClass} variant="secondary" disabled={busy} onClick={onDownloadDocx}><Download className="h-4 w-4" /> Скачать DOCX</Button>
          </>
        )}
        {status === 'SIGNED' && (
          <>
            <Button className={buttonClass} variant="secondary" disabled={busy} onClick={onDownloadPdf}><Download className="h-4 w-4" /> Скачать PDF</Button>
            <Button className={buttonClass} variant="secondary" disabled={busy} onClick={onDownloadDocx}><Download className="h-4 w-4" /> Скачать DOCX</Button>
            <Button className={buttonClass} disabled={busy} onClick={onReplace}><RotateCcw className="h-4 w-4" /> Создать исправленную версию</Button>
          </>
        )}
        {status === 'REPLACED' && (
          <>
            <Button className={buttonClass} variant="secondary" disabled={busy} onClick={onDownloadPdf}><Download className="h-4 w-4" /> Скачать архивный PDF</Button>
            {onOpenReplacement && <Button className={buttonClass} disabled={busy} onClick={onOpenReplacement}><Eye className="h-4 w-4" /> Открыть новый протокол</Button>}
          </>
        )}
        {status === 'CANCELLED' && <span className="text-sm font-semibold text-slate-500">Только просмотр</span>}
      </div>
    </div>
  );
};

export default ProtocolActionsBar;
