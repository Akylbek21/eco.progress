type Props = {
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
  onGenerate?: () => void;
};

const ProtocolExplanatoryNoteForm = ({ value, readOnly, onChange, onGenerate }: Props) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Пояснительная записка</h2>
        <p className="mt-1 text-sm text-slate-500">Этот текст попадет в протокол как дополнительное пояснение к результатам испытаний.</p>
      </div>
      {!readOnly && <div className="flex gap-2">
        <button type="button" onClick={onGenerate} className="rounded-lg border border-eco-200 px-3 py-2 text-sm font-bold text-eco-800 hover:bg-eco-50">Вставить пример пояснения</button>
        <button type="button" onClick={() => onChange('')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Очистить</button>
      </div>}
    </div>
    <textarea
      rows={14}
      disabled={readOnly}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500"
      placeholder="Дополнительные сведения, замечания и пояснения к результатам испытаний"
    />
  </section>
);

export default ProtocolExplanatoryNoteForm;
