import Button from '../../../components/ui/Button';

export const JournalEmptyState = ({ filtered, canCreate, onCreate }: { filtered: boolean; canCreate: boolean; onCreate: () => void }) => <div className="p-10 text-center text-sm text-slate-600"><p>{filtered ? 'По выбранным фильтрам записи не найдены.' : 'В журнале пока нет записей.'}</p>{!filtered && <p className="mt-1">Добавьте первую запись.</p>}{!filtered && canCreate && <Button type="button" className="mt-4" onClick={onCreate}>Добавить первую запись</Button>}</div>;
