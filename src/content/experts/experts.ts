import type { ExpertProfile } from '../types';

export const experts: ExpertProfile[] = [{
  slug: 'ecoprogress-editorial', fullName: 'Редакция EcoProgress', position: 'Редакция материалов',
  specialization: ['структурирование экологической документации', 'практические материалы для бизнеса'],
  bio: 'Организационный автор. Материалы со статусом requires-specialist-review требуют проверки профильным экологом и не отображаются как проверенные экспертом.',
  articles: [], verificationStatus: 'verified',
}];
export const expertMap = new Map(experts.map((item) => [item.slug, item]));
