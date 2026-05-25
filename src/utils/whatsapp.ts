import { COMPANY_CONTACTS } from '../config/contacts';

export const defaultWhatsAppRequestMessage = `Здравствуйте! Хочу оставить заявку на экологические услуги.

Услуга:
Название компании:
БИН:
Город:
Контактное лицо:
Телефон:
Комментарий:`;

export const createWhatsAppUrl = (message: string) => {
  const phone = COMPANY_CONTACTS.whatsappPhone;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

export const createBlankWhatsAppRequestMessage = (service = '') => `Здравствуйте! Хочу оставить заявку.

Услуга: ${service}
Название компании:
БИН:
Город:
Контактное лицо:
Телефон:
Комментарий:`;

type WhatsAppLeadValues = {
  service: string;
  name: string;
  phone: string;
  company?: string;
  bin?: string;
  city?: string;
  comment?: string;
};

export const createWhatsAppLeadMessage = ({
  service,
  name,
  phone,
  company,
  bin,
  city,
  comment,
}: WhatsAppLeadValues) => `Здравствуйте! Хочу оставить заявку на услугу ecoprogress.kz.

Услуга: ${service}
Имя: ${name}
Телефон: ${phone}
Компания: ${company || 'не указано'}
БИН: ${bin || 'не указано'}
Город: ${city || 'не указано'}

Комментарий:
${comment || 'не указано'}

Источник: сайт ecoprogress.kz`;
