import { CheckCircle2, Download, Eye, FileDown, FileText, RotateCcw, Save, SearchCheck, Signature, Trash2, Undo2 } from 'lucide-react';
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

const ProtocolActionsBar = (props: Props) => {
  const { status, busy = false, canApprove = false } = props;
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:-mx-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {status === 'DRAFT' && <>
          <Button disabled={busy} onClick={props.onSave}><Save className="h-4 w-4" /> Сохранить</Button>
          <Button variant="secondary" disabled={busy} onClick={props.onCheckNormatives}><SearchCheck className="h-4 w-4" /> Проверить нормативы</Button>
          <Button variant="secondary" disabled={busy} onClick={props.onPreview}><Eye className="h-4 w-4" /> Предпросмотр</Button>
          <Button disabled={busy} onClick={props.onReady}><CheckCircle2 className="h-4 w-4" /> Готов к утверждению</Button>
          <Button variant="secondary" className="text-rose-700" disabled={busy} onClick={props.onDelete}><Trash2 className="h-4 w-4" /> Удалить</Button>
        </>}
        {status === 'READY_FOR_APPROVAL' && <>
          <Button variant="secondary" disabled={busy} onClick={props.onPreview}><Eye className="h-4 w-4" /> Предпросмотр</Button>
          {canApprove && <Button variant="secondary" disabled={busy} onClick={props.onReturnDraft}><Undo2 className="h-4 w-4" /> Вернуть в черновик</Button>}
          {canApprove && <Button disabled={busy} onClick={props.onApprove}><CheckCircle2 className="h-4 w-4" /> Утвердить</Button>}
        </>}
        {status === 'APPROVED' && <>
          <Button variant="secondary" disabled={busy} onClick={props.onPreview}><Eye className="h-4 w-4" /> Предпросмотр</Button>
          <Button variant="secondary" disabled={busy} onClick={props.onGenerateDocx}><FileText className="h-4 w-4" /> Сформировать DOCX</Button>
          <Button variant="secondary" disabled={busy} onClick={props.onGeneratePdf}><FileDown className="h-4 w-4" /> Сформировать PDF</Button>
          <Button disabled={busy} onClick={props.onSign}><Signature className="h-4 w-4" /> Подписать</Button>
        </>}
        {status === 'SIGNED' && <>
          <Button variant="secondary" disabled={busy} onClick={props.onPreview}><Eye className="h-4 w-4" /> Предпросмотр</Button>
          <Button variant="secondary" disabled={busy} onClick={props.onDownloadDocx}><Download className="h-4 w-4" /> Скачать DOCX</Button>
          <Button variant="secondary" disabled={busy} onClick={props.onDownloadPdf}><Download className="h-4 w-4" /> Скачать PDF</Button>
          <Button disabled={busy} onClick={props.onReplace}><RotateCcw className="h-4 w-4" /> Создать исправленную версию</Button>
        </>}
        {status === 'REPLACED' && <>
          <Button variant="secondary" disabled={busy} onClick={props.onDownloadPdf}><Download className="h-4 w-4" /> Скачать архивный PDF</Button>
          {props.onOpenReplacement && <Button onClick={props.onOpenReplacement}><Eye className="h-4 w-4" /> Открыть новую версию</Button>}
        </>}
        {status === 'CANCELLED' && <span className="text-sm font-semibold text-slate-500">Протокол аннулирован. Доступен только просмотр.</span>}
      </div>
    </div>
  );
};

export default ProtocolActionsBar;
