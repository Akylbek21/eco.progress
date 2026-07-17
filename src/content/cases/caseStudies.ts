import type { CaseStudy } from '../types';

export const caseStudies: CaseStudy[] = [
  { slug: 'environmental-documents-draft', title: 'Проект экологической документации', industry: '[ДОБАВИТЬ РЕАЛЬНЫЕ ДАННЫЕ ПРОЕКТА]', region: '[ДОБАВИТЬ РЕГИОН]', serviceSlugs: ['ecological-documents'], clientDescription: '[ДОБАВИТЬ ФАКТИЧЕСКИЕ ДАННЫЕ]', initialSituation: '[ДОБАВИТЬ ФАКТИЧЕСКИЕ ДАННЫЕ]', problem: '[ДОБАВИТЬ ФАКТИЧЕСКИЕ ДАННЫЕ]', projectFacts: [], workCompleted: [], result: [], verificationStatus: 'draft' },
  { slug: 'laboratory-draft', title: 'Лабораторные исследования', industry: '[ДОБАВИТЬ РЕАЛЬНЫЕ ДАННЫЕ ПРОЕКТА]', region: '[ДОБАВИТЬ РЕГИОН]', serviceSlugs: ['laboratory-tests'], clientDescription: '[ДОБАВИТЬ ФАКТИЧЕСКИЕ ДАННЫЕ]', initialSituation: '[ДОБАВИТЬ ФАКТИЧЕСКИЕ ДАННЫЕ]', problem: '[ДОБАВИТЬ ФАКТИЧЕСКИЕ ДАННЫЕ]', projectFacts: [], workCompleted: [], result: [], verificationStatus: 'draft' },
];

export const publishedCaseStudies = caseStudies.filter((item) => item.verificationStatus === 'approved');
