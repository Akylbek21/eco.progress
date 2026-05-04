export const company = {
  name: 'ECOPROGRESS GROUP',
  phone: '+7 (___) ___-__-__',
  phoneHref: 'tel:+77000000000',
  whatsapp: '77000000000',
  whatsappDisplay: '+7 (___) ___-__-__',
  email: 'info@ecoprogress.kz',
  address: 'Республика Казахстан, г. Астана',
  schedule: 'Пн-Пт, 09:00-18:00',
  instagram: '@ecoprogress.group',
  mapsUrl: 'https://go.2gis.com/',
  siteUrl: 'https://ecoprogress.kz',
};

export const whatsappConsultationText = 'Здравствуйте! Хочу получить консультацию по экологическим услугам. Город: ';

export const getWhatsAppUrl = (text = whatsappConsultationText) => `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(text)}`;
