import { describe, expect, it } from 'vitest';
import { expertMap } from '../src/content/experts/experts';
import { normalizePublicCase } from '../src/content/publicCaseNormalizer';
import type { CmsCaseDto } from '../src/content/types';

const dto: CmsCaseDto = {
  id: 'pek-shymkent-1',
  slug: 'pek-proizvodstvo-shymkent',
  title: 'Актуализация программы ПЭК для производственного предприятия',
  description: 'Действующая программа, сведения об источниках и план мониторинга.',
  city: 'Шымкент',
  region: 'Туркестанская область',
  industry: 'Производство',
  objectType: 'Производственное предприятие',
  objectCategory: 'II категория',
  serviceType: 'program-pek',
  task: 'Актуализировать программу ПЭК после изменения технологического процесса.',
  solution: 'Проверили документы, уточнили источники и актуализировали программу.',
  workPerformed: ['Проверили исходные документы', 'Уточнили источники воздействия', 'Актуализировали программу ПЭК'],
  regulations: [{ title: 'Экологический кодекс Республики Казахстан' }],
  metrics: [{ label: 'Источники', value: '17' }, { label: 'Точки мониторинга', value: '8' }],
  result: 'Заказчику передана актуализированная программа ПЭК.',
  duration: '15 рабочих дней',
  completedAt: '2026-07-10',
  expertId: 'duisenbai-ruslan-serikbaiuly',
  reviewerId: 'duisenbai-ruslan-serikbaiuly',
  reviewStatus: 'APPROVED',
  reviewedAt: '2026-08-20',
  images: [],
  clientAnonymous: true,
  published: true,
  publishedAt: '2026-08-21',
  updatedAt: '2026-08-21',
};

describe('public CMS case policy', () => {
  it('normalizes a confirmed case and preserves its project stages', () => {
    const result = normalizePublicCase(dto, expertMap);
    expect(result?.status).toBe('published');
    expect(result?.reviewer?.slug).toBe('duisenbai-ruslan-serikbaiuly');
    expect(result?.workPerformed).toHaveLength(3);
    expect(result?.metrics?.[0]).toEqual({ label: 'Источники', value: '17' });
    expect(result?.clientAnonymous).toBe(true);
  });

  it('rejects draft approval and unknown reviewers', () => {
    expect(normalizePublicCase({ ...dto, reviewStatus: 'DRAFT' }, expertMap)).toBeNull();
    expect(normalizePublicCase({ ...dto, reviewerId: 'unknown' }, expertMap)).toBeNull();
  });
});
