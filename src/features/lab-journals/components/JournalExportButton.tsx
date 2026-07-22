import { Download, FileDown } from 'lucide-react';
import Button from '../../../components/ui/Button';

type Props = { disabled?: boolean; busy: 'template' | 'export' | ''; onTemplate: () => void; onExport: () => void };
export const JournalExportButton = ({ disabled, busy, onTemplate, onExport }: Props) => <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={disabled || Boolean(busy)} onClick={onTemplate}><FileDown className="h-4 w-4" />{busy === 'template' ? 'Скачивание...' : 'Скачать пустой шаблон'}</Button><Button type="button" variant="secondary" disabled={disabled || Boolean(busy)} onClick={onExport}><Download className="h-4 w-4" />{busy === 'export' ? 'Формирование...' : 'Экспортировать журнал'}</Button></div>;
