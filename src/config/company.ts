import { COMPANY_CONTACTS } from './contacts';
import { createWhatsAppUrl } from '../utils/whatsapp';
import { appConfig } from './app';
import { COMPANY_INFO as COMPANY } from './companyInfo';

export const company = {
  name: COMPANY.name,
  brandName: COMPANY.brandName,
  phone: COMPANY_CONTACTS.phoneDisplay,
  phoneHref: `tel:+${COMPANY_CONTACTS.phone}`,
  whatsapp: COMPANY_CONTACTS.whatsappPhone,
  whatsappDisplay: COMPANY_CONTACTS.whatsappDisplay,
  email: COMPANY.email,
  address: `г. ${COMPANY.address.city}, ${COMPANY.address.street}`,
  schedule: COMPANY.workingHours,
  instagram: COMPANY.instagram,
  instagramUrl: COMPANY.instagramUrl,
  tiktokUrl: COMPANY.tiktokUrl,
  telegramUrl: COMPANY.telegramUrl,
  mapsUrl: COMPANY.mapsUrl,
  siteLabel: 'ecoprogress.kz',
  siteUrl: appConfig.siteUrl,
};

export const whatsappConsultationText = 'Здравствуйте! Хочу получить консультацию по экологическим услугам. Город: ';

export const getWhatsAppUrl = (text = whatsappConsultationText) => createWhatsAppUrl(text);
