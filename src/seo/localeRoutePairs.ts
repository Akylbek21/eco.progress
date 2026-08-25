export const localeRoutePairs = [
  { pageId: 'home', type: 'main', ruPath: '/', kkPath: '/kk/' },
  { pageId: 'services', type: 'service', serviceSlug: 'ecological-documents', ruPath: '/services', kkPath: '/kk/ekologiyalyq-qyzmetter' },
  { pageId: 'service:waste-passport', type: 'service', serviceSlug: 'waste-passport', ruPath: '/services/waste-passport', kkPath: '/kk/qaldyqtar-pasporty' },
  { pageId: 'service:ndv', type: 'service', serviceSlug: 'ndv', ruPath: '/services/ndv', kkPath: '/kk/services/ndv' },
  { pageId: 'service:program-pek', type: 'service', serviceSlug: 'program-pek', ruPath: '/services/program-pek', kkPath: '/kk/pek-bagdarlamasy' },
  { pageId: 'service:report-pek', type: 'service', serviceSlug: 'report-pek', ruPath: '/services/report-pek', kkPath: '/kk/pek-esebi' },
  { pageId: 'service:environmental-permits', type: 'service', serviceSlug: 'environmental-permits', ruPath: '/services/environmental-permits', kkPath: '/kk/ekologiyalyq-ruqsat' },
  { pageId: 'service:szz', type: 'service', serviceSlug: 'szz', ruPath: '/services/szz', kkPath: '/kk/sanitariyalyq-qorgau-aimagy' },
  { pageId: 'service:laboratory-tests', type: 'service', serviceSlug: 'laboratory-tests', ruPath: '/services/laboratory-tests', kkPath: '/kk/zerthanalyq-zertteuler' },
  { pageId: 'service:water-analysis', type: 'service', serviceSlug: 'water-analysis', ruPath: '/services/water-analysis', kkPath: '/kk/su-analizi' },
  { pageId: 'service:waste-recycling', type: 'service', serviceSlug: 'waste-recycling', ruPath: '/services/waste-recycling', kkPath: '/kk/qaldyqtardy-kadege-zharatu' },
  { pageId: 'service-city:program-pek:shymkent', type: 'service-city', serviceSlug: 'program-pek', city: 'Шымкент', ruPath: '/pek-shymkent', kkPath: '/kk/pek-bagdarlamasy-shymkent' },
] as const;

export type LocalizedPageIdentity = (typeof localeRoutePairs)[number];

export const localePairForId = (pageId: string) => localeRoutePairs.find((item) => item.pageId === pageId);

const comparable = (path: string) => path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}`;

export const localePairForPath = (path: string) => {
  const normalized = comparable(path);
  return localeRoutePairs.find((item) => comparable(item.ruPath) === normalized || comparable(item.kkPath) === normalized);
};

export const alternatePathFor = (path: string) => {
  const normalized = comparable(path);
  const pair = localePairForPath(normalized);
  if (!pair) return undefined;
  return comparable(pair.ruPath) === normalized ? pair.kkPath : pair.ruPath;
};
