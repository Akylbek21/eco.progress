import { MapPin } from 'lucide-react';
import { company } from '../config/company';

const TwoGisMap = () => (
  <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
    <a href={company.mapsUrl} target="_blank" rel="noreferrer" className="flex min-h-[320px] flex-col items-center justify-center bg-gradient-to-br from-eco-950 via-eco-800 to-eco-600 px-6 text-center text-white sm:min-h-[420px]">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25"><MapPin size={42} className="text-accent" aria-hidden="true" /></span>
      <span className="mt-6 text-2xl font-bold">{company.name} на карте</span>
      <span className="mt-3 text-base text-white/80">{company.address}</span>
      <span className="mt-6 rounded-full bg-accent px-5 py-3 text-sm font-bold text-eco-950">Показать точку в 2GIS</span>
    </a>
    <div className="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-bold text-eco-900">{company.name}</p>
        <p className="mt-1 text-sm text-slate-600">{company.address}</p>
      </div>
      <a
        href={company.mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center rounded-xl bg-eco-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-eco-800"
      >
        Открыть в 2GIS
      </a>
    </div>
  </div>
);

export default TwoGisMap;
