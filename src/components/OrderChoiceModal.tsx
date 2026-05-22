import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Monitor, MessageCircle, Send, ArrowLeft } from 'lucide-react';
import Button from './ui/Button';
import { company, getWhatsAppUrl } from '../config/company';
import { useAuth } from '../contexts/AuthContext';
import { trackWhatsAppClick } from '../services/analytics';
import { getServices } from '../services/serviceService';
import { useEffect } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  preSelectedService?: string;
};

type EcoService = { id: string; title: string };

const OrderChoiceModal = ({ open, onClose, preSelectedService }: Props) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<'choice' | 'whatsapp'>('choice');
  const [services, setServices] = useState<EcoService[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setMode('choice');
      getServices().then((list) => setServices(list.map((s) => ({ id: s.id, title: s.title }))));
    }
  }, [open]);

  if (!open) return null;

  const handleOnline = () => {
    onClose();
    if (isAuthenticated) {
      navigate(preSelectedService ? `/cabinet/orders/new?service=${preSelectedService}` : '/cabinet/orders/new');
    } else {
      navigate('/register');
    }
  };

  const handleWhatsAppSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '');
    const phone = String(form.get('phone') || '');
    const companyName = String(form.get('company') || '');
    const service = String(form.get('service') || '');
    const comment = String(form.get('comment') || '');

    const lines = [
      `Здравствуйте! Хочу заказать услугу.`,
      `Имя: ${name}`,
      `Телефон: ${phone}`,
      companyName && `Компания: ${companyName}`,
      `Услуга: ${service}`,
      comment && `Комментарий: ${comment}`,
    ].filter(Boolean);

    const url = getWhatsAppUrl(lines.join('\n'));
    trackWhatsAppClick({ placement: 'order_modal', service });
    window.open(url, '_blank');
    setSending(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl sm:p-8" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
          <X size={20} />
        </button>

        {mode === 'choice' && (
          <>
            <h2 className="text-2xl font-bold text-eco-900">Заказать услугу</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Чтобы заказать услугу онлайн, зарегистрируйтесь и создайте заявку в личном кабинете. Если не хотите проходить регистрацию, отправьте заявку через WhatsApp.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleOnline}
                className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-eco-100 p-6 text-center transition hover:border-eco-600 hover:bg-eco-50"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-eco-100 text-eco-700 transition group-hover:bg-eco-600 group-hover:text-white">
                  <Monitor size={24} />
                </div>
                <span className="text-base font-bold text-eco-900">Заказать онлайн</span>
                <span className="text-xs text-slate-500">{isAuthenticated ? 'Перейти в личный кабинет' : 'Регистрация и личный кабинет'}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('whatsapp')}
                className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-eco-100 p-6 text-center transition hover:border-[#25D366] hover:bg-green-50"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-[#25D366] transition group-hover:bg-[#25D366] group-hover:text-white">
                  <MessageCircle size={24} />
                </div>
                <span className="text-base font-bold text-eco-900">Через WhatsApp</span>
                <span className="text-xs text-slate-500">Без регистрации</span>
              </button>
            </div>
          </>
        )}

        {mode === 'whatsapp' && (
          <>
            <button type="button" onClick={() => setMode('choice')} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-eco-700 hover:text-eco-900">
              <ArrowLeft size={16} /> Назад
            </button>
            <h2 className="text-xl font-bold text-eco-900">Заявка через WhatsApp</h2>
            <p className="mt-2 text-sm text-slate-500">Заполните форму — данные откроются в WhatsApp для отправки менеджеру.</p>
            <form onSubmit={handleWhatsAppSubmit} className="mt-5 grid gap-4">
              <label className="block text-sm font-semibold text-slate-700">
                Имя *
                <input name="name" required placeholder="Ваше имя" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Телефон *
                <input name="phone" type="tel" required placeholder="+7 (___) ___-__-__" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Название компании
                <input name="company" placeholder="ТОО «...»" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Услуга *
                <select name="service" required defaultValue={services.find((s) => s.id === preSelectedService)?.title ?? ''} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <option value="">Выберите услугу</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.title}>{s.title}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Комментарий
                <textarea name="comment" rows={3} placeholder="Опишите задачу..." className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm" />
              </label>
              <Button type="submit" disabled={sending} className="mt-1 w-full gap-2 bg-[#25D366] hover:bg-[#20bd5a]">
                <Send size={16} /> Отправить в WhatsApp
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderChoiceModal;
