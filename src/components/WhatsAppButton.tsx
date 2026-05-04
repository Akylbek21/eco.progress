import { MessageCircle } from 'lucide-react';
import { companyContacts } from '../data/mockData';

const WhatsAppButton = () => {
  const message = encodeURIComponent('Здравствуйте! Хочу получить консультацию по экологическим услугам.');
  const href = `https://wa.me/${companyContacts.whatsapp}?text=${message}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Написать в WhatsApp"
      className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl shadow-eco-900/20 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eco-700"
    >
      <MessageCircle size={25} />
    </a>
  );
};

export default WhatsAppButton;
