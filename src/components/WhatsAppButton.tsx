import clsx from 'clsx';
import { FaWhatsapp } from 'react-icons/fa';
import { createWhatsAppUrl, defaultWhatsAppRequestMessage } from '../utils/whatsapp';
import { trackWhatsAppClick } from '../services/analytics';

type WhatsAppButtonProps = {
  label?: string;
  message?: string;
  floating?: boolean;
  className?: string;
  locale?: 'ru' | 'kk';
};

const kkWhatsAppRequestMessage = `Сәлеметсіз бе! Экологиялық қызметке өтінім қалдырғым келеді.

Қызмет:
Қала:
Телефон / WhatsApp:
Сұрақ:`;

const WhatsAppButton = ({ label, message, floating = false, className, locale = 'ru' }: WhatsAppButtonProps) => {
  const accessibleLabel = locale === 'kk' ? 'WhatsApp арқылы жазу' : 'Написать в WhatsApp';
  const text = label ?? (floating ? '' : accessibleLabel);
  const requestMessage = message ?? (locale === 'kk' ? kkWhatsAppRequestMessage : defaultWhatsAppRequestMessage);

  return (
    <a
      href={createWhatsAppUrl(requestMessage)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={accessibleLabel}
      onClick={() => trackWhatsAppClick({ placement: floating ? 'floating_button' : 'whatsapp_button' })}
      className={clsx(
        'inline-flex min-w-0 items-center justify-center gap-2 rounded-full bg-[#25D366] font-bold leading-snug text-white shadow-lg shadow-green-900/15 transition hover:scale-105 hover:bg-[#20bd5a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]',
        floating
          ? 'fixed bottom-5 right-5 z-40 h-14 w-14 text-xl sm:h-16 sm:w-16'
          : 'px-5 py-3 text-center text-sm sm:px-6',
        className,
      )}
    >
      <FaWhatsapp className="shrink-0" size={floating ? 28 : 18} aria-hidden="true" />
      {text && <span>{text}</span>}
      {!text && <span className="sr-only">{accessibleLabel}</span>}
    </a>
  );
};

export default WhatsAppButton;
