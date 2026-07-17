export type ServiceCategory = 'Проектирование' | 'Разрешения' | 'Лаборатория' | 'Отходы' | 'Предприятия';
export type CatalogSource = 'api' | 'fallback';

export interface ServiceCatalogItem {
  id: string;
  slug: string;
  apiId?: number | string;
  category: ServiceCategory;
  title: string;
  shortTitle?: string;
  shortDescription: string;
  fullDescription: string;
  icon?: string;
  image?: string;
  areaServed: { type: 'KAZAKHSTAN' | 'SHYMKENT_ONLY' | 'SELECTED_REGIONS'; regions?: string[]; description: string; remote?: boolean; onSite?: boolean };
  pricing: { priceFrom?: number; priceTo?: number; currency: 'KZT'; calculatorBasePrice?: number; priceText?: string; requiresCalculation: boolean };
  duration: { minDays?: number; maxDays?: number; text: string };
  requiredDocuments: string[];
  workflow: Array<{ order: number; title: string; description: string }>;
  deliverables: string[];
  exclusions?: string[];
  targetClients: string[];
  legalBasis?: Array<{ title: string; documentNumber?: string; url?: string }>;
  faq: Array<{ question: string; answer: string }>;
  relatedServiceSlugs: string[];
  relatedArticleSlugs: string[];
  seo: { title: string; description: string; keywords?: string[] };
  isActive: boolean;
  showOnHome: boolean;
  showInCalculator: boolean;
  showInTariffs: boolean;
}

const workflow = (steps: string[]) => steps.map((title, index) => ({ order: index + 1, title, description: `${title} в согласованном объёме работ.` }));
const faq = (title: string) => [
  { question: `Как рассчитывается стоимость услуги «${title}»?`, answer: 'После анализа объекта, категории предприятия, объёма работ и исходных документов.' },
  { question: 'Можно ли начать с неполным комплектом документов?', answer: 'Да. Специалист проверит имеющиеся материалы и подготовит список недостающих данных.' },
];
const buildSeoTitle = (title: string) => {
  const base = `${title} | ECOPROGRESS`;
  return base.length < 35 ? `${title} для бизнеса | ECOPROGRESS` : base;
};
const buildSeoDescription = (description: string) => description.length >= 100
  ? description
  : `${description} Состав, сроки и стоимость уточняются после анализа объекта и исходных документов.`;

const item = (value: Partial<ServiceCatalogItem> & Pick<ServiceCatalogItem, 'slug' | 'title' | 'category' | 'shortDescription'>): ServiceCatalogItem => ({
  id: value.slug,
  apiId: value.slug,
  fullDescription: value.shortDescription,
  image: '/cottonbro.jpg',
  areaServed: { type: 'KAZAKHSTAN', description: 'Доступно по Казахстану; подготовка документов выполняется дистанционно.', remote: true, onSite: false },
  pricing: { currency: 'KZT', requiresCalculation: true },
  duration: { text: 'Срок определяется после анализа исходных данных.' },
  requiredDocuments: ['Реквизиты компании', 'Описание объекта и задачи', 'Имеющиеся исходные документы'],
  workflow: workflow(['Консультация', 'Анализ исходных данных', 'Выполнение работ', 'Передача результата']),
  deliverables: ['Результат работ в согласованном договором составе', 'Рекомендации по дальнейшим действиям'],
  targetClients: ['ТОО и ИП', 'Производственные и строительные объекты'],
  faq: faq(value.title),
  relatedServiceSlugs: [],
  relatedArticleSlugs: [],
  seo: { title: buildSeoTitle(value.title), description: buildSeoDescription(value.shortDescription) },
  isActive: true,
  showOnHome: false,
  showInCalculator: false,
  showInTariffs: false,
  ...value,
});

export const serviceCatalog: ServiceCatalogItem[] = [
  item({ slug: 'ecological-documents', title: 'Экологические документы', category: 'Проектирование', shortDescription: 'Подготовка экологических документов, программ, отчётов и разрешительных материалов для бизнеса.', image: '/cottonbro.jpg', pricing: { priceFrom: 180000, currency: 'KZT', calculatorBasePrice: 180000, requiresCalculation: true }, duration: { minDays: 10, text: 'от 10 рабочих дней' }, showOnHome: true, showInCalculator: true, showInTariffs: true, relatedServiceSlugs: ['environmental-design', 'environmental-permits', 'ecological-support'], relatedArticleSlugs: ['kakie-shtrafy-za-ekologiyu-v-kazakhstane'] }),
  item({ slug: 'environmental-design', title: 'Экологическое проектирование', category: 'Проектирование', shortDescription: 'Основная коммерческая услуга по разработке экологических проектов для строительства и действующих объектов.', pricing: { priceFrom: 180000, priceTo: 350000, currency: 'KZT', calculatorBasePrice: 180000, requiresCalculation: true }, showInCalculator: true, showInTariffs: true, relatedServiceSlugs: ['ndv', 'ovos', 'puo'], relatedArticleSlugs: [] }),
  item({ slug: 'ndv', title: 'Проект нормативов допустимых выбросов', shortTitle: 'Проект НДВ', category: 'Проектирование', shortDescription: 'Инвентаризация источников, расчёты выбросов и подготовка проекта НДВ.', relatedServiceSlugs: ['environmental-design', 'environmental-permits'], relatedArticleSlugs: [] }),
  item({ slug: 'puo', title: 'Программа управления отходами', shortTitle: 'ПУО', category: 'Проектирование', shortDescription: 'Анализ потоков отходов, целевые показатели и программа управления отходами.', relatedServiceSlugs: ['ecological-documents', 'waste-recycling'], relatedArticleSlugs: [] }),
  item({ slug: 'ovos', title: 'Оценка воздействия на окружающую среду', shortTitle: 'ОВОС', category: 'Проектирование', shortDescription: 'Подготовка ОВОС и материалов экологической оценки для проектов.', relatedServiceSlugs: ['environmental-design', 'environmental-permits'], relatedArticleSlugs: [] }),
  item({ slug: 'environmental-permits', title: 'Экологические разрешения и декларации', category: 'Разрешения', shortDescription: 'Подготовка разрешительных материалов и сопровождение процедур по требованиям РК.', relatedServiceSlugs: ['environmental-design', 'ecological-documents'], relatedArticleSlugs: [] }),
  item({ slug: 'laboratory-tests', title: 'Лабораторные исследования', category: 'Лаборатория', shortDescription: 'Анализы воды, воздуха и почвы, замеры выбросов и протоколы исследований.', image: '/edward.jpg', areaServed: { type: 'SELECTED_REGIONS', regions: ['shymkent', 'turkestan', 'taraz', 'kyzylorda', 'almaty'], description: 'Выездные исследования выполняются в согласованных регионах.', remote: false, onSite: true }, pricing: { priceFrom: 90000, currency: 'KZT', calculatorBasePrice: 90000, requiresCalculation: true }, duration: { minDays: 5, maxDays: 10, text: '5–10 рабочих дней' }, showOnHome: true, showInCalculator: true, showInTariffs: true, relatedServiceSlugs: ['industrial-control', 'ecological-documents'], relatedArticleSlugs: [] }),
  item({ slug: 'industrial-control', title: 'Производственный контроль СЭС', category: 'Лаборатория', shortDescription: 'Программа производственного контроля, замеры и протоколы для санитарных требований.', image: '/edward.jpg', areaServed: { type: 'SELECTED_REGIONS', regions: ['shymkent', 'turkestan', 'taraz', 'kyzylorda', 'almaty'], description: 'Документы готовятся дистанционно, замеры требуют согласованного выезда.', remote: true, onSite: true }, relatedServiceSlugs: ['laboratory-tests', 'ecological-support'], relatedArticleSlugs: [] }),
  item({ slug: 'program-pek', title: 'Программа производственного экологического контроля', shortTitle: 'Программа ПЭК', category: 'Проектирование', shortDescription: 'Программа контроля по фактическим источникам, показателям и процессам предприятия.', relatedServiceSlugs: ['report-pek', 'laboratory-tests', 'ecological-support'], relatedArticleSlugs: ['chto-takoe-proizvodstvennyy-ekologicheskiy-kontrol', 'kak-formiruetsya-otchet-pek'] }),
  item({ slug: 'report-pek', title: 'Отчёт производственного экологического контроля', shortTitle: 'Отчёт ПЭК', category: 'Проектирование', shortDescription: 'Проверка первичных данных и подготовка отчёта ПЭК за согласованный период.', relatedServiceSlugs: ['program-pek', 'laboratory-tests', 'ecological-support'], relatedArticleSlugs: ['kak-formiruetsya-otchet-pek', 'chto-sdavat-po-ekologii-kazhdyy-god'] }),
  item({ slug: 'waste-transportation', title: 'Вывоз отходов', category: 'Отходы', shortDescription: 'Сбор и транспортировка отходов с объекта с оформлением сопроводительных документов.', image: '/jose.jpg', areaServed: { type: 'SHYMKENT_ONLY', regions: ['shymkent'], description: 'Выезд и транспортировка доступны только в Шымкенте.', remote: false, onSite: true }, pricing: { priceFrom: 80000, currency: 'KZT', calculatorBasePrice: 80000, requiresCalculation: true }, duration: { minDays: 1, maxDays: 3, text: '1–3 рабочих дня' }, showOnHome: true, showInCalculator: true, showInTariffs: true, relatedServiceSlugs: ['waste-recycling', 'waste-management', 'poligon-tbo'], relatedArticleSlugs: [] }),
  item({ slug: 'waste-recycling', title: 'Утилизация отходов', category: 'Отходы', shortDescription: 'Передача отходов на утилизацию или переработку и оформление подтверждающих документов.', image: '/utilizacija-othodov-3.jpg', areaServed: { type: 'SHYMKENT_ONLY', regions: ['shymkent'], description: 'Приём и выезд доступны только в Шымкенте.', remote: false, onSite: true }, pricing: { currency: 'KZT', requiresCalculation: true }, showOnHome: true, showInTariffs: true, relatedServiceSlugs: ['waste-transportation', 'waste-management'], relatedArticleSlugs: [] }),
  item({ slug: 'waste-management', title: 'Комплексное обращение с отходами', category: 'Отходы', shortDescription: 'Коммерческая страница комплексного вывоза, утилизации и документального сопровождения отходов.', image: '/jose.jpg', areaServed: { type: 'SHYMKENT_ONLY', regions: ['shymkent'], description: 'Комплексная услуга доступна в Шымкенте.', remote: false, onSite: true }, pricing: { priceFrom: 120000, currency: 'KZT', calculatorBasePrice: 120000, requiresCalculation: true }, showInCalculator: true, showInTariffs: true, relatedServiceSlugs: ['waste-transportation', 'waste-recycling'], relatedArticleSlugs: [] }),
  item({ slug: 'poligon-tbo', title: 'Полигон ТБО', category: 'Отходы', shortDescription: 'Приём и законное размещение ТБО с документами для организаций.', image: '/poligon-tbo-2.jpg', areaServed: { type: 'SHYMKENT_ONLY', regions: ['shymkent'], description: 'Приём отходов осуществляется в Шымкенте.', remote: false, onSite: true }, showOnHome: true, relatedServiceSlugs: ['waste-transportation', 'waste-recycling'], relatedArticleSlugs: [] }),
  item({ slug: 'environmental-audit', title: 'Сопровождение экологических проверок', category: 'Предприятия', shortDescription: 'Аудит документов, оценка рисков и подготовка предприятия к экологической проверке.', image: '/images (1).jpg', pricing: { priceFrom: 25000, currency: 'KZT', calculatorBasePrice: 25000, requiresCalculation: true }, showOnHome: true, showInCalculator: true, showInTariffs: true, relatedServiceSlugs: ['ecological-support', 'ecological-documents'], relatedArticleSlugs: ['kakie-shtrafy-za-ekologiyu-v-kazakhstane'] }),
  item({ slug: 'ecological-support', title: 'Экологическое сопровождение предприятия', category: 'Предприятия', shortDescription: 'Регулярный контроль отчётности, документов, сроков и экологических рисков предприятия.', pricing: { priceFrom: 350000, currency: 'KZT', calculatorBasePrice: 350000, priceText: 'в месяц', requiresCalculation: true }, showInCalculator: true, showInTariffs: true, relatedServiceSlugs: ['environmental-audit', 'ecological-documents'], relatedArticleSlugs: [] }),
];

export const serviceSlugAliases: Record<string, string> = {
  'eco-design': 'ecological-documents',
  laboratory: 'laboratory-tests',
  permits: 'environmental-permits',
  landfill: 'poligon-tbo',
  'enterprise-support': 'ecological-support',
};

export const normalizeServiceSlug = (slug: string) => serviceSlugAliases[slug] ?? slug;
export const getCatalogService = (slug: string) => serviceCatalog.find((service) => service.slug === normalizeServiceSlug(slug));
export const activeServices = serviceCatalog.filter((service) => service.isActive);

export const formatKztPrice = (pricing: ServiceCatalogItem['pricing']): string => {
  if (pricing.priceText && pricing.priceFrom === undefined && pricing.priceTo === undefined) return pricing.priceText;
  const money = (value: number) => new Intl.NumberFormat('ru-RU').format(value);
  if (pricing.priceFrom !== undefined && pricing.priceTo !== undefined) return `от ${money(pricing.priceFrom)} до ${money(pricing.priceTo)} ₸${pricing.priceText ? ` ${pricing.priceText}` : ''}`;
  if (pricing.priceFrom !== undefined) return `от ${money(pricing.priceFrom)} ₸${pricing.priceText ? ` ${pricing.priceText}` : ''}`;
  return 'Стоимость рассчитывается индивидуально';
};

export const PRELIMINARY_PRICE_NOTICE = 'Расчёт является предварительным. Итоговая стоимость определяется после анализа объекта, категории предприятия, объёма работ и исходных документов.';
