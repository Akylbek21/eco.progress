const publicEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

export const COMPANY = {
  name: 'ECOPROGRESS GROUP',
  brandName: 'EcoProgress',
  domain: 'https://ecoprogress.kz',
  email: publicEnv.VITE_COMPANY_EMAIL || 'eco.progresss@gmail.com',
  address: {
    country: 'KZ',
    city: 'Шымкент',
    street: publicEnv.VITE_COMPANY_STREET || 'мкр Восток, 66',
    postalCode: publicEnv.VITE_COMPANY_POSTAL_CODE || '',
  },
  phone: {
    value: '77781211158',
    display: '+7 778 121 11 58',
  },
  whatsapp: {
    value: '77771858088',
    display: '+7 777 185 80 88',
  },
  workingHours: 'Пн-Пт, 09:00-18:00',
  logo: 'https://ecoprogress.kz/favicon.png',
  defaultOgImage: 'https://ecoprogress.kz/media/social/ecoprogress-og-1200x630.jpg',
  instagram: '@ecoprogress.group',
  instagramUrl: 'https://www.instagram.com/ecoprogress.group',
  tiktokUrl: 'https://www.tiktok.com/@ecoprogress.group',
  mapsUrl: 'https://2gis.kz/shymkent/firm/70000001113587757/center/69.64210867881776,42.33840753960456/zoom/18',
} as const;
