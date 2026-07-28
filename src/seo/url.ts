export const SITE_ORIGIN = 'https://ecoprogress.kz';

export const normalizePathname = (pathname: string): string => {
  const path = pathname.split(/[?#]/, 1)[0] || '/';
  if (path === '/') return '/';
  return `/${path.replace(/^\/+|\/+$/g, '')}`;
};

export const absoluteUrl = (value: string, origin = SITE_ORIGIN): string => {
  const url = new URL(value || '/', origin);
  url.protocol = 'https:';
  url.hostname = 'ecoprogress.kz';
  url.port = '';
  url.search = '';
  url.hash = '';
  url.pathname = normalizePathname(url.pathname);
  return url.pathname === '/' ? SITE_ORIGIN : `${SITE_ORIGIN}${url.pathname}`;
};
