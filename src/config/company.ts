import { COMPANY_CONTACTS } from './contacts';
import { createWhatsAppUrl } from '../utils/whatsapp';

export const company = {
  name: 'ecoprogress.kz',
  phone: COMPANY_CONTACTS.whatsappDisplay,
  phoneHref: `tel:+${COMPANY_CONTACTS.whatsappPhone}`,
  whatsapp: COMPANY_CONTACTS.whatsappPhone,
  whatsappDisplay: COMPANY_CONTACTS.whatsappDisplay,
  email: 'info@ecoprogress.kz',
  address: 'Республика Казахстан, г. Астана',
  schedule: 'Пн-Пт, 09:00-18:00',
  instagram: '@ecoprogress.group',
  mapsUrl: 'https://go.2gis.com/',
  siteUrl: 'https://ecoprogress.kz',
};

export const whatsappConsultationText = 'Здравствуйте! Хочу получить консультацию по экологическим услугам. Город: ';

export const getWhatsAppUrl = (text = whatsappConsultationText) => createWhatsAppUrl(text);
