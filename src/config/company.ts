import { COMPANY_CONTACTS } from './contacts';
import { createWhatsAppUrl } from '../utils/whatsapp';

export const company = {
  name: 'ecoprogress.kz',
  phone: COMPANY_CONTACTS.phoneDisplay,
  phoneHref: `tel:+${COMPANY_CONTACTS.phone}`,
  whatsapp: COMPANY_CONTACTS.whatsappPhone,
  whatsappDisplay: COMPANY_CONTACTS.whatsappDisplay,
  email: 'ecoprogress@gmail.com',
  address: 'г. Шымкент, Алимбетова 199/2а',
  schedule: 'Пн-Пт, 09:00-18:00',
  instagram: '@eco.progress.kz',
  instagramUrl: 'https://www.instagram.com/eco.progress.kz',
  mapsUrl: 'https://go.2gis.com/',
  siteLabel: 'eco.progress.kz',
  siteUrl: 'https://eco.progress.kz',
};

export const whatsappConsultationText = 'Здравствуйте! Хочу получить консультацию по экологическим услугам. Город: ';

export const getWhatsAppUrl = (text = whatsappConsultationText) => createWhatsAppUrl(text);
