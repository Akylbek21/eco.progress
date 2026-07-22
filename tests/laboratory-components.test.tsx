import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import LaboratoryForm from '../src/components/laboratories/LaboratoryForm';
import { LaboratoryEmptyState } from '../src/features/laboratories/components/LaboratoryEmptyState';
import { LaboratoryStatusChip } from '../src/features/laboratories/components/LaboratoryStatusChip';

describe('laboratory components', () => {
  it('renders separate base and filtered empty states', () => {
    expect(renderToStaticMarkup(<LaboratoryEmptyState />)).toContain('Лаборатории ещё не созданы');
    expect(renderToStaticMarkup(<LaboratoryEmptyState filtered />)).toContain('По заданным фильтрам');
  });

  it('renders active/default and inactive statuses with sufficient text labels', () => {
    expect(renderToStaticMarkup(<LaboratoryStatusChip laboratory={{ active: true, isDefault: true }} />)).toContain('Активная · по умолчанию');
    expect(renderToStaticMarkup(<LaboratoryStatusChip laboratory={{ active: false, isDefault: false }} />)).toContain('Неактивная');
  });

  it('renders the complete accessible laboratory form and leadership selectors', () => {
    const html = renderToStaticMarkup(<LaboratoryForm initial={{ id: 1, name: 'Лаборатория', address: 'Адрес', active: true, isDefault: false, accreditationStatus: 'NOT_SPECIFIED' }} employees={[]} busy={false} canEditAccreditation onCancel={vi.fn()} onSave={vi.fn()} />);
    for (const label of ['Полное название', 'Юридическое название', 'Адрес', 'БИН', 'Аккредитация', 'Директор', 'Заведующий лабораторией', 'По умолчанию']) expect(html).toContain(label);
  });
});
