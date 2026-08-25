import { describe, expect, it } from 'vitest';
import { normalizePublicService, type PublicServiceDto } from '../src/content/publicServiceNormalizer';

const backendService: PublicServiceDto = {
  id: 'laboratory',
  title: 'Лабораторные исследования',
  category: 'Лаборатория',
  description: 'Проводим лабораторные исследования и замеры с выдачей протоколов.',
  forWhom: 'Предприятиям, которым нужно подтвердить экологическую безопасность.',
  result: 'Протоколы лабораторных исследований и замеров.',
  includes: ['Химический анализ воды', 'Анализ атмосферного воздуха'],
  documents: ['Описание объекта исследования', 'Адрес и точки отбора проб'],
  workflow: ['Уточняем задачу исследования', 'Проводим отбор проб или замеры'],
  duration: 'срок зависит от вида анализа',
  status: 'APPROVED',
  reviewStatus: 'APPROVED',
  reviewedAt: null,
  updatedAt: '2026-05-15T10:14:11.181579Z',
  aeo: {
    shortAnswer: null,
    whoNeeds: null,
    whenRequired: null,
    whenNotRequired: null,
    requiredDocuments: [],
    customerReceives: [],
    timeline: null,
    pricingFactors: [],
    legalBasis: [],
    commonMistakes: [],
    faq: [],
  },
  relatedCases: [],
};

describe('public service DTO normalization', () => {
  it('maps the approved backend service contract without static fallback content', () => {
    const result = normalizePublicService(backendService);
    expect(result.serviceSlug).toBe('laboratory-tests');
    expect(result.status).toBe('approved');
    expect(result.hero).toMatchObject({ title: backendService.title, subtitle: backendService.description });
    expect(result.summary.clientResult).toBe(backendService.result);
    expect(result.targetClients).toEqual([{ title: backendService.forWhom }]);
    expect(result.requiredDocuments.map((item) => item.title)).toEqual(backendService.documents);
    expect(result.deliverables.map((item) => item.title)).toEqual(backendService.includes);
    expect(result.workflow.map((item) => item.title)).toEqual(backendService.workflow);
    expect(result.aeo.shortAnswer).toBe(backendService.description);
    expect(result.aeo.faq).toEqual([]);
    expect(result.contentReview).toMatchObject({ reviewStatus: 'approved', lastReviewedAt: backendService.updatedAt });
  });

  it.each([
    ['eco-design', 'ecological-documents'],
    ['permits', 'environmental-permits'],
    ['landfill', 'poligon-tbo'],
    ['enterprise-support', 'ecological-support'],
    ['waste-management', 'waste-management'],
    ['waste-transportation', 'waste-transportation'],
  ])('maps backend id %s to the active catalog slug %s', (id, expected) => {
    expect(normalizePublicService({ ...backendService, id }).serviceSlug).toBe(expected);
  });
});
