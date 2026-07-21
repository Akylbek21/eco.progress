export const publicRouteLoaders = {
  home: () => import('../pages/HomePage'),
  services: () => import('../pages/ServicesPage'),
  regions: () => import('../pages/RegionsPage'),
  news: () => import('../pages/NewsPage'),
  about: () => import('../pages/AboutPage'),
  contacts: () => import('../pages/ContactsPage'),
  login: () => import('../pages/LoginPage'),
} as const;

const routeLoaderByPath = {
  '/': publicRouteLoaders.home,
  '/services': publicRouteLoaders.services,
  '/regions': publicRouteLoaders.regions,
  '/news': publicRouteLoaders.news,
  '/about': publicRouteLoaders.about,
  '/contacts': publicRouteLoaders.contacts,
  '/login': publicRouteLoaders.login,
} as const;

const started = new Set<string>();

export const preloadPublicRoute = (path: string) => {
  const loader = routeLoaderByPath[path as keyof typeof routeLoaderByPath];
  if (!loader || started.has(path)) return;
  started.add(path);
  void loader().catch(() => started.delete(path));
};
