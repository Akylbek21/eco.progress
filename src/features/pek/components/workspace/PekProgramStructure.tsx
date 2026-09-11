import { useQuery } from '@tanstack/react-query';
import type { PekMonitoringDirection, PekMonitoringType, PekProgram } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';

export type PekWorkspaceSection = 'overview' | 'controls' | 'organization' | 'documents';
type SectionStatus = 'complete' | 'attention' | 'not-applicable';

const monitoringSections: Array<{ type: PekMonitoringType; label: string }> = [
  { type: 'AMBIENT_AIR', label: 'Атмосферный воздух' },
  { type: 'EMISSION_SOURCE', label: 'Источники выбросов' },
  { type: 'SURFACE_WATER', label: 'Поверхностные воды' },
  { type: 'GROUNDWATER', label: 'Подземные воды' },
  { type: 'WASTEWATER', label: 'Сточные воды' },
  { type: 'SOIL', label: 'Почва' },
  { type: 'WASTE', label: 'Отходы' },
  { type: 'PHYSICAL_FACTOR', label: 'Физические факторы' },
];

const statusPresentation: Record<SectionStatus, { symbol: string; label: string; className: string }> = {
  complete: { symbol: '✓', label: 'Раздел заполнен', className: 'bg-emerald-50 text-emerald-700' },
  attention: { symbol: '!', label: 'Требует заполнения', className: 'bg-amber-50 text-amber-800' },
  'not-applicable': { symbol: '—', label: 'Неприменимо', className: 'bg-slate-100 text-slate-500' },
};

const directionStatus = (direction?: PekMonitoringDirection): SectionStatus => {
  if (!direction) return 'attention';
  if (!direction.active) return 'not-applicable';
  return direction.controlItemIds.length > 0 && Boolean(direction.frequencyType) && direction.plannedCount > 0
    ? 'complete'
    : 'attention';
};

const Status = ({ value }: { value: SectionStatus }) => {
  const view = statusPresentation[value];
  return <span title={view.label} aria-label={view.label} className={`inline-grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black ${view.className}`}>{view.symbol}</span>;
};

const SectionRow = ({ label, status, onClick }: { label: string; status: SectionStatus; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-eco-600">
    <span className="font-semibold text-slate-800">{label}</span>
    <Status value={status} />
  </button>
);

const PekProgramStructure = ({ program, readinessPercent, onOpenSection }: { program: PekProgram; readinessPercent?: number | null; onOpenSection: (section: PekWorkspaceSection) => void }) => {
  const inspections = useQuery({ queryKey: pekKeys.programSection(program.id, 'internal-inspections'), queryFn: ({ signal }) => pekApi.getInternalInspections(program.id, signal) });
  const qa = useQuery({ queryKey: pekKeys.programSection(program.id, 'measurement-qa'), queryFn: ({ signal }) => pekApi.getMeasurementQa(program.id, signal) });
  const emergencies = useQuery({ queryKey: pekKeys.programSection(program.id, 'emergency-procedures'), queryFn: ({ signal }) => pekApi.getEmergencyProcedures(program.id, signal) });
  const responsibilities = useQuery({ queryKey: pekKeys.programSection(program.id, 'responsibilities'), queryFn: ({ signal }) => pekApi.getResponsibilities(program.id, signal) });

  const generalComplete = Boolean(program.company?.id && program.object?.id && program.number && program.name && program.validFrom && program.validUntil && (program.responsibleUserId || program.responsible?.id));
  const monitoring = program.monitoring?.items || [];
  const organization = [
    { label: 'Внутренние проверки', query: inspections },
    { label: 'QA/QC измерений', query: qa },
    { label: 'Действия при ЧС', query: emergencies },
    { label: 'Ответственность', query: responsibilities },
  ];
  return <section aria-labelledby="pek-program-structure-title" className="rounded-2xl border bg-white p-5 sm:p-7">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Официальная структура</p>
        <h2 id="pek-program-structure-title" className="mt-1 text-xl font-black text-slate-900">Программа ПЭК</h2>
      </div>
      <div className="text-right"><p className="text-xs font-bold uppercase text-slate-500">Готовность</p><p className="text-2xl font-black text-slate-900">{readinessPercent == null ? '—' : `${readinessPercent}%`}</p></div>
    </div>

    <div className="space-y-6">
      <div className="space-y-1">
        <SectionRow label="Общие сведения" status={generalComplete ? 'complete' : 'attention'} onClick={() => onOpenSection('overview')} />
        <SectionRow label="Разрешительные документы" status={program.permitIds?.length ? 'complete' : 'attention'} onClick={() => onOpenSection('documents')} />
      </div>

      <div>
        <h3 className="mb-2 px-3 text-sm font-black uppercase tracking-wide text-slate-500">Производственный мониторинг</h3>
        <div className="ml-3 space-y-1 border-l border-slate-200 pl-3">
          {monitoringSections.map(({ type, label }) => {
            const direction = monitoring.find((item) => item.monitoringType === type);
            return <SectionRow key={type} label={label} status={directionStatus(direction)} onClick={() => onOpenSection('controls')} />;
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 px-3 text-sm font-black uppercase tracking-wide text-slate-500">Организация контроля</h3>
        <div className="ml-3 space-y-1 border-l border-slate-200 pl-3">
          {organization.map(({ label, query }) => <SectionRow key={label} label={label} status={query.data?.length ? 'complete' : 'attention'} onClick={() => onOpenSection('organization')} />)}
        </div>
      </div>
    </div>

    <div className="mt-6 flex flex-wrap gap-4 border-t pt-4 text-xs text-slate-500">
      <span><strong className="text-emerald-700">✓</strong> заполнено</span>
      <span><strong className="text-amber-700">!</strong> требует внимания</span>
      <span><strong>—</strong> неприменимо</span>
    </div>
  </section>;
};

export default PekProgramStructure;
