type NamedEntity = {
  name?: string | null;
};

const EntityName = ({
  value,
  fallback = 'Не указано',
  className,
}: {
  value?: NamedEntity | null;
  fallback?: string;
  className?: string;
}) => {
  const name = value?.name?.trim();
  return <span className={className}>{name || fallback}</span>;
};

export default EntityName;

