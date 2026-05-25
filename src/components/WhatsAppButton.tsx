import clsx from 'clsx';
import { FaWhatsapp } from 'react-icons/fa';
import { createWhatsAppUrl, defaultWhatsAppRequestMessage } from '../utils/whatsapp';
import { trackWhatsAppClick } from '../services/analytics';

type WhatsAppButtonProps = {
  label?: string;
  message?: string;
  floating?: boolean;
  className?: string;
};

const WhatsAppButton = ({
  label,
  message = defaultWhatsAppRequestMessage,
  floating = false,
  className,
}: WhatsAppButtonProps) => {
  const text = label ?? (floating ? '' : 'Оставить заявку через WhatsApp');

  return (
    <a
      href={createWhatsAppUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Написать в WhatsApp"
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
      {!text && <span className="sr-only">WhatsApp</span>}
    </a>
  );
};

export default WhatsAppButton;
