import { PekPageHeader } from '../components/common/PekUi';

const PekSettingsPage = () => <div className="space-y-5">
  <PekPageHeader
    title="Настройки ПЭК"
    description="Справочная информация о действующем backend-контракте"
  />
  <section className="rounded-2xl border bg-white p-5">
    <h2 className="font-black">Настраиваемых параметров нет</h2>
    <p className="mt-2 text-sm text-slate-600">
      Текущий backend ПЭК не предоставляет endpoint для изменения настроек. Frontend не сохраняет
      локальные значения и не имитирует конфигурацию.
    </p>
  </section>
</div>;

export default PekSettingsPage;
