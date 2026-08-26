import { COMPANY_CONTACTS } from '../config/contacts';

export const defaultWhatsAppRequestMessage = `Здравствуйте! Хочу оставить заявку на экологические услуги.

Услуга:
Город:
Телефон / WhatsApp:
Что вам нужно:`;

export const createWhatsAppUrl = (message: string) => {
  const phone = COMPANY_CONTACTS.whatsappPhone;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

export const createBlankWhatsAppRequestMessage = (service = '') => `Здравствуйте! Хочу оставить заявку.

Услуга: ${service}
Город:
Телефон / WhatsApp:
Что вам нужно:`;

type WhatsAppLeadValues = {
  service: string;
  phone: string;
  city?: string;
  comment?: string;
};

export const createWhatsAppLeadMessage = ({
  service,
  phone,
  city,
  comment,
}: WhatsAppLeadValues) => `Здравствуйте! Хочу оставить заявку на услугу ecoprogress.kz.

Услуга: ${service}
Телефон / WhatsApp: ${phone}
Город: ${city || 'не указано'}

Что вам нужно:
${comment || 'не указано'}

Источник: сайт ecoprogress.kz`;
