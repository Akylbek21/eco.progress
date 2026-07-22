import Modal from '../../../components/ui/Modal';
import type { JournalTypeDefinition, LabJournalEntry } from '../../../types/labJournal';
import { JournalEntryForm } from './JournalEntryForm';

type Props = { open: boolean; definition: JournalTypeDefinition; laboratoryId: number; entry?: LabJournalEntry; mode: 'create' | 'view' | 'edit'; dirty: boolean; busy: boolean; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void; onClose: () => void; onSaved: (entry: LabJournalEntry) => void; onSuccessMessage: (message: string) => void };

export const JournalEntryDialog = ({ open, definition, laboratoryId, entry, mode, dirty, busy, onDirtyChange, onBusyChange, onClose, onSaved, onSuccessMessage }: Props) => {
  const close = () => {
    if (busy) return;
    if (dirty && !window.confirm('Есть несохранённые изменения. Продолжить?')) return;
    onClose();
  };
  return <Modal open={open} onClose={close} title={mode === 'create' ? 'Добавить запись' : mode === 'edit' ? 'Редактировать запись' : 'Просмотр записи'} size="xl" loading={busy} closeOnBackdrop={!busy}><JournalEntryForm definition={definition} laboratoryId={entry?.laboratoryId || laboratoryId} entry={entry} readOnly={mode === 'view'} onDirtyChange={onDirtyChange} onSubmittingChange={onBusyChange} onCancel={close} onSaved={onSaved} onSuccessMessage={onSuccessMessage} /></Modal>;
};
