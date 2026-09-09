import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FocusEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import OrderChoiceModal from '../OrderChoiceModal';
import QueryRuntime from '../../runtime/QueryRuntime';
import { publicContentRepository } from '../../content/apiRepository';
import { caseStudies } from '../../content/cases/caseStudies';
import { trackEvent } from '../../services/analytics';
import {
  projectLocations,
  projectRegionNames,
  projectServiceLabel,
  projectServiceLabels,
  projectServiceSlugs,
  toProjectCases,
  type ProjectCase,
} from '../../data/projectMapData';
import './ProjectGeography.css';

type MapMode = 'cities' | 'regions';
type Selection = { kind: 'city' | 'region'; id: string } | null;
type RegionShape = { pcode: string; path: string; cx: number; cy: number };
type TooltipState = { regionId: string; x: number; y: number } | null;

const heatColors = ['#7896B2', '#6B8CAA', '#5C7F9E', '#4C7190', '#3C607F'];
const extrusionSteps = [8, 6, 4, 2];
const projectWord = (count: number) => count % 10 === 1 && count % 100 !== 11 ? 'проект' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'проекта' : 'проектов';
const realizedWord = (count: number) => count % 10 === 1 && count % 100 !== 11 ? 'реализованный' : 'реализованных';
const projectPoint = ([longitude, latitude]: [number, number]) => ({
  x: 10 + ((longitude - 46.5) / (87.3 - 46.5)) * 580,
  y: 330 - ((latitude - 40.5) / (55.5 - 40.5)) * 320,
});
const heatColor = (count: number, maximum: number) => !count || !maximum
  ? heatColors[0]
  : heatColors[Math.max(1, Math.ceil((count / maximum) * (heatColors.length - 1)))];

const ProjectGeographyMap = () => {
  const { data: publishedCases = [] } = useQuery({
    queryKey: ['public-content', 'cases'],
    queryFn: () => publicContentRepository.getCases(),
    initialData: caseStudies,
    staleTime: 5 * 60 * 1000,
  });
  const [regions, setRegions] = useState<RegionShape[]>([]);
  const [service, setService] = useState('ALL');
  const [mode, setMode] = useState<MapMode>('cities');
  const [selection, setSelection] = useState<Selection>(null);
  const [selectedCase, setSelectedCase] = useState<ProjectCase | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [orderOpen, setOrderOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/project-geography/data/kazakhstan-regions.json', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Map unavailable')))
      .then((data: RegionShape[]) => setRegions(data))
      .catch((error) => { if (!(error instanceof DOMException && error.name === 'AbortError')) setRegions([]); });
    return () => controller.abort();
  }, []);

  const projects = useMemo(() => toProjectCases(publishedCases), [publishedCases]);
  const services = useMemo(() => [...new Set(projects.map((item) => item.serviceCode))].map((code) => ({ code, label: projectServiceLabel(code, publishedCases) })), [projects, publishedCases]);
  const filtered = useMemo(() => service === 'ALL' ? projects : projects.filter((item) => item.serviceCode === service), [projects, service]);
  const cityCounts = useMemo(() => filtered.reduce((counts, item) => counts.set(item.cityId, (counts.get(item.cityId) || 0) + 1), new Map<string, number>()), [filtered]);
  const regionCounts = useMemo(() => filtered.reduce((counts, item) => counts.set(item.regionId, (counts.get(item.regionId) || 0) + 1), new Map<string, number>()), [filtered]);
  const maxRegionCount = Math.max(0, ...regionCounts.values());
  const selectedLocation = selection?.kind === 'city' ? projectLocations.find((item) => item.id === selection.id) : undefined;
  const selectedName = selection?.kind === 'city' ? selectedLocation?.name : selection ? projectRegionNames[selection.id] : undefined;
  const selectedCases = selection ? filtered.filter((item) => selection.kind === 'city' ? item.cityId === selection.id : item.regionId === selection.id) : [];

  useEffect(() => {
    setSelectedCase(null);
    const wrongMode = selection && ((mode === 'cities') !== (selection.kind === 'city'));
    const hasCases = selection && filtered.some((item) => selection.kind === 'city' ? item.cityId === selection.id : item.regionId === selection.id);
    if (selection && (wrongMode || !hasCases)) setSelection(null);
  }, [filtered, mode, selection]);

  const chooseCity = (id: string) => {
    if (selection?.kind === 'city' && selection.id === id) return;
    setSelection({ kind: 'city', id });
    setSelectedCase(null);
  };
  const chooseRegion = (id: string) => {
    if (!regionCounts.get(id) || (selection?.kind === 'region' && selection.id === id)) return;
    setSelection({ kind: 'region', id });
    setSelectedCase(null);
  };
  const showPointerTooltip = (regionId: string, event: ReactPointerEvent<SVGPathElement>) => {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (bounds) setTooltip({ regionId, x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  };
  const showFocusTooltip = (region: RegionShape, event: FocusEvent<SVGPathElement>) => {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (bounds) setTooltip({ regionId: region.pcode, x: (region.cx / 600) * bounds.width, y: (region.cy / 340) * bounds.height });
  };
  const tooltipCount = tooltip ? regionCounts.get(tooltip.regionId) || 0 : 0;
  const filteredProjectText = service === 'LAB'
    ? `${tooltipCount} ${tooltipCount === 1 ? 'лабораторный' : 'лабораторных'} ${projectWord(tooltipCount)}`
    : `${tooltipCount} ${projectWord(tooltipCount)}`;
  const orderService = service !== 'ALL' ? service : selectedCase?.serviceCode;
  const leadContext = selection ? {
    source: 'PROJECT_MAP' as const,
    cityId: selection.kind === 'city' ? selection.id : undefined,
    regionId: selection.kind === 'region' ? selection.id : selectedLocation?.regionId,
    locationName: selectedName,
    serviceCode: orderService,
    caseId: selectedCase?.id,
  } : undefined;

  return <section id="project-geography" aria-label="Интерактивная карта проектов Казахстана" className="project-map-section">
    <div className="project-map-toolbar">
      <div className="project-map-filter" aria-label="Фильтр по услугам">
        {[{ code: 'ALL', label: 'Все' }, ...services].map((item) => <button key={item.code} type="button" aria-pressed={service === item.code} onClick={() => setService(item.code)}>{item.label}</button>)}
      </div>
      <div className="project-map-mode" aria-label="Режим карты">
        <button type="button" aria-pressed={mode === 'cities'} onClick={() => setMode('cities')}>Города</button>
        <button type="button" aria-pressed={mode === 'regions'} onClick={() => setMode('regions')}>Области</button>
      </div>
    </div>

    <div className="project-map-shell">
      <div className="project-map-canvas">
        <div className="project-map-plane">
        <svg className="project-map-svg" viewBox="0 0 600 340" role="img" aria-label="Карта Казахстана с количеством проектов по регионам">
          <defs>
            <filter id="project-map-outline" x="-3%" y="-5%" width="106%" height="110%" colorInterpolationFilters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius=".7" result="expanded"/><feFlood floodColor="#10283E" result="borderColor"/><feComposite in="borderColor" in2="expanded" operator="in"/></filter>
            <linearGradient id="project-map-depth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#244D6B"/><stop offset="1" stopColor="#102D45"/></linearGradient>
            <linearGradient id="project-map-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity=".2"/><stop offset=".42" stopColor="#DDEAF5" stopOpacity=".04"/><stop offset="1" stopColor="#102E47" stopOpacity=".2"/></linearGradient>
          </defs>
          <g className="project-map-extrusion" aria-hidden="true">{extrusionSteps.map((offset) => <g key={offset} transform={`translate(0 ${offset})`}>{regions.map((region) => <path key={`${offset}-${region.pcode}`} d={region.path} />)}</g>)}</g>
          <g className="project-map-country-outline" aria-hidden="true">{regions.map((region) => <path key={`outline-${region.pcode}`} d={region.path} />)}</g>
          <g className="project-map-top">{regions.map((region) => {
            const count = regionCounts.get(region.pcode) || 0;
            const selected = selection?.kind === 'region' && selection.id === region.pcode;
            return <path key={region.pcode} d={region.path} className={`project-map-region${selected ? ' is-selected' : ''}${count ? '' : ' is-empty'}`} style={{ fill: heatColor(count, maxRegionCount) }} tabIndex={mode === 'regions' && count ? 0 : -1} role={mode === 'regions' && count ? 'button' : undefined} aria-label={`${projectRegionNames[region.pcode] || region.pcode}: ${count} ${projectWord(count)}`} aria-disabled={!count} onPointerMove={(event) => showPointerTooltip(region.pcode, event)} onPointerLeave={() => setTooltip(null)} onFocus={(event) => showFocusTooltip(region, event)} onBlur={() => setTooltip(null)} onClick={() => mode === 'regions' && chooseRegion(region.pcode)} onKeyDown={(event) => { if (mode === 'regions' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); chooseRegion(region.pcode); } }} />;
          })}</g>
          <g className="project-map-sheen" aria-hidden="true">{regions.map((region) => <path key={`sheen-${region.pcode}`} d={region.path} />)}</g>
        </svg>

        {mode === 'cities' && projectLocations.map((location) => {
          const count = cityCounts.get(location.id) || 0;
          if (!count) return null;
          const point = projectPoint(location.coordinates);
          const selected = selection?.kind === 'city' && selection.id === location.id;
          return <div key={location.id} className={`project-city-anchor${point.x > 475 ? ' opens-left' : ''}`} style={{ left: `${(point.x / 600) * 100}%`, top: `${(point.y / 340) * 100}%` }}>
            <button type="button" className={`project-city-marker${selected ? ' is-selected' : ''}`} aria-label={`${location.name}: ${count} ${projectWord(count)}`} onClick={() => chooseCity(location.id)}><span className="project-city-label">{location.name} · </span><span>{count}</span><span className="project-city-projects"> {projectWord(count)}</span></button>
          </div>;
        })}

        {mode === 'regions' && regions.map((region) => {
          const count = regionCounts.get(region.pcode) || 0;
          if (!count) return null;
          return <button key={`count-${region.pcode}`} type="button" className={`project-region-count${selection?.kind === 'region' && selection.id === region.pcode ? ' is-selected' : ''}`} style={{ left: `${(region.cx / 600) * 100}%`, top: `${(region.cy / 340) * 100}%` }} aria-label={`${projectRegionNames[region.pcode]}: ${count} ${projectWord(count)}`} onClick={() => chooseRegion(region.pcode)}>{count}</button>;
        })}
        </div>

        {tooltip && <div className="project-region-tooltip" role="tooltip" style={{ left: tooltip.x, top: tooltip.y }}><strong>{projectRegionNames[tooltip.regionId] || tooltip.regionId}</strong><span>{filteredProjectText}</span></div>}
      </div>

      {selection && <aside className="project-map-drawer" aria-label={`Проекты: ${selectedName}`}>
        <div className="project-drawer-head"><div><h2>{selectedName}</h2><p>{selectedCases.length} {realizedWord(selectedCases.length)} {projectWord(selectedCases.length)}</p></div><button type="button" aria-label="Закрыть проекты" onClick={() => { setSelection(null); setSelectedCase(null); }}>×</button></div>
        <div className="project-drawer-cases">
          {selectedCases.map((item) => <article key={item.id} className={selectedCase?.id === item.id ? 'is-selected' : ''}>
            <span className="project-case-service">{projectServiceLabels[item.serviceCode] || projectServiceLabel(item.serviceCode, publishedCases)}</span>
            <h3>{item.title}</h3>
            {item.year && <time>{item.year}</time>}
            {selectedCase?.id === item.id && item.description && <p>{item.description}</p>}
            <button type="button" onClick={() => setSelectedCase(item)}>Подробнее →</button>
            {selectedCase?.id === item.id && item.href && <Link to={item.href}>Открыть страницу кейса →</Link>}
          </article>)}
        </div>
        <Link className="project-all-cases" to="/cases">Показать все проекты</Link>
        <div className="project-drawer-cta"><p>Нужен похожий проект?</p><button type="button" onClick={() => { trackEvent('consultation_click', { placement: 'project_map', ...(leadContext || { source: 'PROJECT_MAP' }) }); setOrderOpen(true); }}>Заказать похожий проект</button></div>
      </aside>}
    </div>

    {orderOpen && <OrderChoiceModal open onClose={() => setOrderOpen(false)} preSelectedService={orderService ? projectServiceSlugs[orderService] : undefined} leadContext={leadContext} />}
  </section>;
};

export default function ProjectGeography() {
  return <QueryRuntime><ProjectGeographyMap /></QueryRuntime>;
}
