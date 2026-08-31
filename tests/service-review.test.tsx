import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ArticleSources, ServiceReviewCard } from '../src/components/content/ContentBlocks';
import { expertMap, isPublishableExpert } from '../src/content/experts/experts';
import { serviceContent } from '../src/content/services/serviceContent';

describe('service specialist review', () => {
  it('marks every primary service as reviewed by a publishable specialist', () => {
    expect(serviceContent.length).toBeGreaterThan(0);
    for (const service of serviceContent) {
      expect(service.contentReview).toMatchObject({
        preparedBy: 'Редакция EcoProgress',
        reviewedBy: 'duisenbai-ruslan-serikbaiuly',
        reviewStatus: 'approved',
        lastReviewedAt: '2026-08-31',
        legalBasisCheckedAt: '2026-08-31',
      });
      expect(isPublishableExpert(expertMap.get(service.contentReview.reviewedBy!))).toBe(true);
    }
  });

  it('renders a claim-to-official-source chain with a formatted verification date', () => {
    const html = renderToStaticMarkup(<ArticleSources title="Нормативная база" sources={[{
      title: 'Правила разработки программы ПЭК',
      url: 'https://adilet.zan.kz/rus/docs/V2100023553',
      sourceName: 'ИПС «Әділет»', documentNumber: 'приказ № 250', issuedAt: '2021-07-14',
      accessedAt: '2026-08-31', claimStatus: 'verified', supports: ['Определяет содержание программы ПЭК.'],
    }]} />);
    expect(html).toContain('Нормативная база');
    expect(html).toContain('приказ № 250');
    expect(html).toContain('Подтверждает');
    expect(html).toContain('Источник:');
    expect(html).toContain('ИПС «Әділет»');
    expect(html).toContain('Проверено:');
    expect(html).toContain('31.08.2026');
  });

  it('renders the specialist, profile link and formatted review dates', () => {
    const expert = expertMap.get('duisenbai-ruslan-serikbaiuly')!;
    const html = renderToStaticMarkup(<ServiceReviewCard expert={expert} reviewedAt="2026-08-31" legalBasisCheckedAt="2026-08-31" />);
    expect(html).toContain('Материал проверен специалистом ECOPROGRESS');
    expect(html).toContain(expert.fullName);
    expect(html).toContain('href="/experts/duisenbai-ruslan-serikbaiuly"');
    expect(html).toContain('Проверено:');
    expect(html).toContain('31.08.2026');
    expect(html).toContain('Нормативная база проверена:');
  });
});
