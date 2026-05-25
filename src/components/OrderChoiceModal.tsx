import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Monitor, X } from 'lucide-react';
import Button from './ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { trackWhatsAppClick } from '../services/analytics';
import { getServices } from '../services/serviceService';
import { createBlankWhatsAppRequestMessage, createWhatsAppUrl } from '../utils/whatsapp';

type Props = {
  open: boolean;
  onClose: () => void;
  preSelectedService?: string;
};

type EcoService = { id: string; title: string };

const OrderChoiceModal = ({ open, onClose, preSelectedService }: Props) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [services, setServices] = useState<EcoService[]>([]);

  useEffect(() => {
    if (open) getServices().then((list) => setServices(list.map((service) => ({ id: service.id, title: service.title }))));
  }, [open]);

  const selectedServiceTitle = useMemo(
    () => services.find((service) => service.id === preSelectedService)?.title || '',
    [preSelectedService, services],
  );

  if (!open) return null;

  const handleOnline = () => {
    onClose();
    if (isAuthenticated) {
      navigate(preSelectedService ? `/cabinet/orders/new?service=${preSelectedService}` : '/cabinet/orders/new');
    } else {
      navigate('/register');
    }
  };

  const whatsappUrl = createWhatsAppUrl(createBlankWhatsAppRequestMessage(selectedServiceTitle));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[24px] bg-white p-5 shadow-2xl sm:p-7" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Закрыть">
          <X size={20} />
        </button>

        <h2 className="pr-10 text-2xl font-bold text-eco-900">Оставить заявку</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
          Выберите удобный способ. Можно работать через личный кабинет или отправить заявку менеджеру в WhatsApp без регистрации.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="flex min-w-0 flex-col rounded-[20px] border border-slate-200 bg-eco-50 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-eco-700 shadow-sm">
              <Monitor size={23} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-eco-900">Заказать через личный кабинет</h3>
            <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
              Для клиентов, которые хотят отслеживать статус, документы, оплату и результат в кабинете.
            </p>
            <Button type="button" onClick={handleOnline} className="mt-5 w-full">
              {isAuthenticated ? 'Перейти в кабинет' : 'Войти / зарегистрироваться'}
            </Button>
          </div>

          <div className="flex min-w-0 flex-col rounded-[20px] border border-green-100 bg-green-50 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#25D366] shadow-sm">
              <MessageCircle size={23} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-eco-900">Оставить заявку через WhatsApp</h3>
            <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
              Без регистрации. Менеджер получит сообщение и свяжется с вами.
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackWhatsAppClick({ placement: 'order_modal', service: selectedServiceTitle || preSelectedService });
                onClose();
              }}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#20bd5a]"
            >
              <MessageCircle size={17} /> Написать в WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderChoiceModal;
