import { PekPageHeader } from '../components/common/PekUi';

const PekSettingsPage = () => <div className="space-y-5">
  <PekPageHeader
    title="Настройки ПЭК"
    description="Параметры производственного экологического контроля"
  />
  <section className="rounded-2xl border bg-white p-5">
    <h2 className="font-black">Настраиваемых параметров нет</h2>
    <p className="mt-2 text-sm text-slate-600">
      Настраиваемые параметры для этого раздела пока не предоставлены. Обратитесь к системному
      администратору, если требуется изменить правила работы ПЭК.
    </p>
  </section>
</div>;

export default PekSettingsPage;
