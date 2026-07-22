import { LAB_JOURNAL_TYPES, type JournalTypeDefinition, type LabJournalType } from '../../../types/labJournal';

type Props = { value: LabJournalType; definitions: JournalTypeDefinition[]; disabled?: boolean; onChange: (value: LabJournalType) => void };

export const JournalTypeSelector = ({ value, definitions, disabled, onChange }: Props) => (
  <label className="space-y-1 text-sm font-semibold text-slate-700">
    <span>Вид журнала</span>
    <select aria-label="Вид журнала" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as LabJournalType)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100">
      {definitions.map((definition) => <option key={definition.code} value={definition.code}>{LAB_JOURNAL_TYPES[definition.code].label}</option>)}
    </select>
  </label>
);
