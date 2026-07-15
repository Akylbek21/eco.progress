import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import OrderChoiceModal from '../components/OrderChoiceModal';
import SEO from '../components/SEO';

const NotFoundPage = () => {
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  return (
    <section className="flex min-h-[70vh] items-center bg-[#F7FBFD] px-4 py-16 sm:px-8">
      <SEO title="Страница не найдена | ECOPROGRESS" description="Страница не найдена. Перейдите на главную или оставьте заявку на экологические услуги." robots="noindex,follow" />
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-eco-500">404</p>
        <h1 className="mt-4 text-4xl font-bold text-eco-900">Страница не найдена</h1>
        <p className="mt-4 leading-7 text-slate-600">Возможно, ссылка изменилась. Перейдите на главную или оставьте заявку, если нужна консультация.</p>
        <div className="mt-8 grid gap-3 sm:flex sm:justify-center">
          <Button asChild><Link to="/">На главную</Link></Button>
          <Button type="button" variant="secondary" onClick={() => setOrderModalOpen(true)}>Оставить заявку</Button>
        </div>
      </div>
      <OrderChoiceModal open={orderModalOpen} onClose={() => setOrderModalOpen(false)} />
    </section>
  );
};

export default NotFoundPage;
