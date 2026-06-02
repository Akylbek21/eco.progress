import { COMPANY_CONTACTS } from './contacts';
import { createWhatsAppUrl } from '../utils/whatsapp';

export const company = {
  name: 'ECOPROGRESS GROUP',
  phone: COMPANY_CONTACTS.phoneDisplay,
  phoneHref: `tel:+${COMPANY_CONTACTS.phone}`,
  whatsapp: COMPANY_CONTACTS.whatsappPhone,
  whatsappDisplay: COMPANY_CONTACTS.whatsappDisplay,
  email: 'ecoprogress@gmail.com',
  address: 'г. Шымкент, Алимбетова 199/2а',
  schedule: 'Пн-Пт, 09:00-18:00',
  instagram: '@ecoprogress.group',
  instagramUrl: 'https://www.instagram.com/ecoprogress.group',
  mapsUrl: 'https://2gis.kz/shymkent/firm/70000001113587757/center/69.637832,42.319356/zoom/16',
  siteLabel: 'ecoprogress.kz',
  siteUrl: 'https://ecoprogress.kz',
};

export const whatsappConsultationText = 'Здравствуйте! Хочу получить консультацию по экологическим услугам. Город: ';

export const getWhatsAppUrl = (text = whatsappConsultationText) => createWhatsAppUrl(text);
