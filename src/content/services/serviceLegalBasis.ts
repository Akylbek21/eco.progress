import type { ServiceContent } from '../types';
import type { ServiceAeoSlug } from './serviceAeo';

type LegalItem = ServiceContent['legalBasis'][number];

const verified = (title: string, number: string, date: string, sourceUrl: string, note: string): LegalItem => ({
  title,
  number,
  date,
  sourceUrl,
  note,
  verificationStatus: 'verified',
  claimStatus: 'verified',
});

const emissionsMethodology = verified(
  'Методики определения нормативов эмиссий в окружающую среду',
  'приказ № 63',
  '2021-03-10',
  'https://adilet.zan.kz/rus/docs/V2100022317',
  'Определяет расчёт и обоснование нормативов эмиссий, включая нормативы допустимых выбросов.',
);

const environmentalAssessmentInstruction = verified(
  'Инструкция по организации и проведению экологической оценки',
  'приказ № 280',
  '2021-07-30',
  'https://adilet.zan.kz/rus/docs/V2100023809',
  'Регулирует организацию экологической оценки, включая ОВОС и экологическую оценку по упрощённому порядку.',
);

const pekRules = verified(
  'Правила разработки программы производственного экологического контроля объектов I и II категорий, ведения внутреннего учёта, формирования и предоставления периодических отчётов',
  'приказ № 250',
  '2021-07-14',
  'https://adilet.zan.kz/rus/docs/V2100023553',
  'Регулирует содержание программы ПЭК, внутренний учёт и периодическую отчётность по результатам контроля.',
);

const wasteClassifier = verified(
  'Классификатор отходов',
  'приказ № 314',
  '2021-08-06',
  'https://adilet.zan.kz/rus/docs/V2100023903',
  'Используется для классификации и кодирования отходов; применимость конкретного кода проверяется по составу и происхождению отхода.',
);

const szzRules = verified(
  'Санитарные правила «Санитарно-эпидемиологические требования к санитарно-защитным зонам объектов»',
  'приказ № ҚР ДСМ-2',
  '2022-01-11',
  'https://adilet.zan.kz/rus/docs/V2200026447',
  'Определяет требования к установлению, проектированию и режиму санитарно-защитных зон и санитарных разрывов.',
);

export const specialLegalBasisBySlug: Partial<Record<ServiceAeoSlug, LegalItem[]>> = {
  ndv: [emissionsMethodology],
  ovos: [environmentalAssessmentInstruction],
  roos: [environmentalAssessmentInstruction],
  'program-pek': [pekRules],
  'report-pek': [pekRules],
  'waste-passport': [wasteClassifier],
  puo: [wasteClassifier],
  'waste-transportation': [wasteClassifier],
  'waste-recycling': [wasteClassifier],
  szz: [szzRules],
};
