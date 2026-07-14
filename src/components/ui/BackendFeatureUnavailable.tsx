type BackendFeatureUnavailableProps = {
  title: string;
  description?: string;
};

const BackendFeatureUnavailable = ({ title, description }: BackendFeatureUnavailableProps) => (
  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
    <p className="font-bold">{title}</p>
    <p className="mt-1 text-sm text-amber-800">
      {description || 'Функция пока не подключена к серверу.'}
    </p>
  </div>
);

export default BackendFeatureUnavailable;
