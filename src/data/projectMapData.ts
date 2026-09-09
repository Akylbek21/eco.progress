import type { CaseStudy } from '../content/types';

export interface ProjectCase {
  id: string;
  title: string;
  serviceCode: string;
  cityId: string;
  regionId: string;
  year?: number;
  description?: string;
  href?: string;
}

export interface ProjectLocation {
  id: string;
  name: string;
  regionId: string;
  coordinates: [number, number];
}

export const projectLocations: ProjectLocation[] = [
  { id: 'almaty', name: 'Алматы', regionId: 'KZ75', coordinates: [76.8897, 43.2389] },
  { id: 'astana', name: 'Астана', regionId: 'KZ71', coordinates: [71.4491, 51.1694] },
  { id: 'shymkent', name: 'Шымкент', regionId: 'KZ79', coordinates: [69.5901, 42.3417] },
  { id: 'taraz', name: 'Тараз', regionId: 'KZ31', coordinates: [71.3667, 42.9] },
  { id: 'turkestan', name: 'Туркестан', regionId: 'KZ61', coordinates: [68.2518, 43.2973] },
  { id: 'kyzylorda', name: 'Кызылорда', regionId: 'KZ43', coordinates: [65.5092, 44.8488] },
  { id: 'aktobe', name: 'Актобе', regionId: 'KZ15', coordinates: [57.167, 50.2839] },
  { id: 'atyrau', name: 'Атырау', regionId: 'KZ23', coordinates: [51.9238, 47.0945] },
  { id: 'karaganda', name: 'Караганда', regionId: 'KZ35', coordinates: [73.1094, 49.8047] },
  { id: 'pavlodar', name: 'Павлодар', regionId: 'KZ55', coordinates: [76.9674, 52.2873] },
  { id: 'ust-kamenogorsk', name: 'Усть-Каменогорск', regionId: 'KZ63', coordinates: [82.6149, 49.9483] },
  { id: 'kostanay', name: 'Костанай', regionId: 'KZ39', coordinates: [63.6246, 53.2144] },
  { id: 'aktau', name: 'Актау', regionId: 'KZ47', coordinates: [51.1975, 43.6532] },
  { id: 'petropavlovsk', name: 'Петропавловск', regionId: 'KZ59', coordinates: [69.1628, 54.8732] },
  { id: 'oral', name: 'Уральск', regionId: 'KZ27', coordinates: [51.3708, 51.2278] },
  { id: 'kokshetau', name: 'Кокшетау', regionId: 'KZ11', coordinates: [69.3883, 53.2833] },
  { id: 'taldykorgan', name: 'Талдыкорган', regionId: 'KZ33', coordinates: [78.3739, 45.0156] },
  { id: 'semey', name: 'Семей', regionId: 'KZ10', coordinates: [80.2275, 50.4111] },
];

export const projectRegionNames: Record<string, string> = {
  KZ10: 'Область Абай', KZ11: 'Акмолинская область', KZ15: 'Актюбинская область', KZ19: 'Алматинская область',
  KZ23: 'Атырауская область', KZ27: 'Западно-Казахстанская область', KZ31: 'Жамбылская область', KZ33: 'Область Жетісу',
  KZ35: 'Карагандинская область', KZ39: 'Костанайская область', KZ43: 'Кызылординская область', KZ47: 'Мангистауская область',
  KZ55: 'Павлодарская область', KZ59: 'Северо-Казахстанская область', KZ61: 'Туркестанская область', KZ62: 'Область Ұлытау',
  KZ63: 'Восточно-Казахстанская область', KZ71: 'Астана', KZ75: 'Алматы', KZ79: 'Шымкент',
};

export const projectServiceLabels: Record<string, string> = {
  PEK: 'ПЭК', LAB: 'Лаборатория', SZZ: 'СЗЗ', NDV: 'НДВ',
};

export const projectServiceSlugs: Record<string, string> = {
  PEK: 'program-pek', LAB: 'laboratory-tests', SZZ: 'szz', NDV: 'ndv',
};

const normalize = (value: string) => value.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
const locationByName = new Map(projectLocations.flatMap((location) => {
  const aliases = [location.name, location.id];
  if (location.id === 'oral') aliases.push('Орал');
  if (location.id === 'ust-kamenogorsk') aliases.push('Өскемен', 'Усть Каменогорск');
  return aliases.map((alias) => [normalize(alias), location] as const);
}));

const regionAliases: Record<string, string[]> = {
  KZ10: ['абай'], KZ11: ['акмол'], KZ15: ['актюб', 'актоб'], KZ19: ['алматинск'], KZ23: ['атырау'],
  KZ27: ['западно казахстан', 'батыс казахстан'], KZ31: ['жамбыл'], KZ33: ['жетісу', 'жетысу'], KZ35: ['караганд'],
  KZ39: ['костанай'], KZ43: ['кызылордин', 'қызылорда'], KZ47: ['мангистау', 'маңғыстау'], KZ55: ['павлодар'],
  KZ59: ['северо казахстан', 'солтүстік казахстан'], KZ61: ['туркестан'], KZ62: ['ұлытау', 'улытау'],
  KZ63: ['восточно казахстан', 'шығыс казахстан'], KZ71: ['астана'], KZ75: ['алматы город'], KZ79: ['шымкент'],
};

const serviceCode = (value: string) => {
  const service = normalize(value);
  if (/пэк|производственн.*эколог|program pek|report pek/.test(service)) return 'PEK';
  if (/лаборатор|laboratory/.test(service)) return 'LAB';
  if (/сзз|санитарно защит|\bszz\b/.test(service)) return 'SZZ';
  if (/ндв|предельно допустим.*выброс|норматив.*выброс|\bndv\b/.test(service)) return 'NDV';
  return service.replace(/\s+/g, '_').toLocaleUpperCase('ru') || 'OTHER';
};

const regionIdFromName = (value: string) => {
  const name = normalize(value);
  return Object.entries(regionAliases).find(([, aliases]) => aliases.some((alias) => name.includes(alias)))?.[0];
};

export const toProjectCases = (cases: CaseStudy[]): ProjectCase[] => cases.flatMap((item) => {
  const location = locationByName.get(normalize(item.city));
  const regionId = regionIdFromName(item.region) || location?.regionId;
  if (!regionId) return [];
  const completedDate = new Date(item.completedAt);
  return [{
    id: item.id,
    title: item.title,
    serviceCode: serviceCode(item.service),
    cityId: location?.id || normalize(item.city).replace(/\s+/g, '-'),
    regionId,
    year: Number.isNaN(completedDate.getTime()) ? undefined : completedDate.getFullYear(),
    description: item.problem,
    href: `/cases/${item.slug}`,
  }];
});

export const projectServiceLabel = (code: string, cases: CaseStudy[]) => projectServiceLabels[code]
  || cases.find((item) => serviceCode(item.service) === code)?.service
  || code;
