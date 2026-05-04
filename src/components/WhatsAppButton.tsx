import { MessageCircle } from 'lucide-react';
import { getWhatsAppUrl } from '../config/company';
import { trackWhatsAppClick } from '../services/analytics';

const WhatsAppButton = () => (
  <a
    href={getWhatsAppUrl()}
    target="_blank"
    rel="noreferrer"
    aria-label="Написать в WhatsApp"
    onClick={() => trackWhatsAppClick({ placement: 'floating_button' })}
    className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl shadow-eco-900/20 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eco-700 sm:h-16 sm:w-16"
  >
    <MessageCircle size={25} />
  </a>
);

export default WhatsAppButton;
