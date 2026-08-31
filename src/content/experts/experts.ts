import type { CmsExpertDto, Expert } from '../types';

const credential = (title: string, document: string, issuedBy: string, date: string, details: Partial<Expert['credentials'][number]> = {}) => ({ title, document, issuedBy, date, ...details });
const laboratoryCompetence = 'ГОСТ ISO/IEC 17025-2019. Общие требования к компетентности испытательных и калибровочных лабораторий';
const internalAudit = 'Подготовка внутренних аудиторов систем менеджмента по ГОСТ ISO/IEC 17025-2019 в соответствии с требованиями СТ РК ISO 19011-2019';
const clever = 'Пользователь информационной платформы для экологов «Clever»';

// Единственный публичный frontend-реестр: только переданные и подтверждённые факты.
const confirmedExperts: Expert[] = [
  {
    id: 'bakytbay-kuralay-nurlankyzy', slug: 'bakytbay-kuralay-nurlankyzy', fullName: 'Бақытбай Құралай Нұрланқызы',
    published: true, verificationStatus: 'VERIFIED', profileUrl: '/experts/bakytbay-kuralay-nurlankyzy',
    specialization: [internalAudit], credentials: [credential(internalAudit, 'Удостоверение', 'Учебный центр «Эксперт»', '22–24.10.2024', { hours: 24, number: '20' })],
  },
  {
    id: 'bektibaeva-ryskul-maratovna', slug: 'bektibaeva-ryskul-maratovna', fullName: 'Бектибаева Рыскуль Маратовна',
    published: true, verificationStatus: 'VERIFIED', profileUrl: '/experts/bektibaeva-ryskul-maratovna',
    specialization: [internalAudit], credentials: [credential(internalAudit, 'Удостоверение', 'Учебный центр «Эксперт»', '22–26.06.2020', { hours: 40, number: '011' })],
  },
  {
    id: 'duisenbai-ruslan-serikbaiuly', slug: 'duisenbai-ruslan-serikbaiuly', fullName: 'Дуйсенбай Руслан Серікбайұлы',
    published: true, verificationStatus: 'VERIFIED', profileUrl: '/experts/duisenbai-ruslan-serikbaiuly',
    specialization: [laboratoryCompetence, 'Новый экологический кодекс Республики Казахстан'],
    credentials: [
      credential(laboratoryCompetence, 'Сертификат', 'ТОО «Учебный центр „Эксперт“»', '10–11.10.2023', { hours: 16, number: '81' }),
      credential('Семинар по разъяснению Нового экологического кодекса РК', 'Подтверждение участия в семинаре', 'Центр распространения знаний АЗЭК / Ассоциация экологических организаций Казахстана', '01.06.2022', { location: 'Шымкент' }),
    ],
  },
  {
    id: 'manap-akerke-maratkyzy', slug: 'manap-akerke-maratkyzy', fullName: 'Манап Ақерке Маратқызы',
    published: true, verificationStatus: 'VERIFIED', profileUrl: '/experts/manap-akerke-maratkyzy', specialization: [laboratoryCompetence],
    credentials: [credential(laboratoryCompetence, 'Сертификат', 'ТОО «Учебный центр „Эксперт“»', '10–11.10.2023', { hours: 16, number: '80' })],
  },
  {
    id: 'omirbaeva-aigerim-kazybekkyzy', slug: 'omirbaeva-aigerim-kazybekkyzy', fullName: 'Өмірбаева Айгерім Қазыбекқызы',
    published: true, verificationStatus: 'VERIFIED', profileUrl: '/experts/omirbaeva-aigerim-kazybekkyzy', specialization: [laboratoryCompetence],
    credentials: [credential(laboratoryCompetence, 'Сертификат', 'ТОО «Учебный центр „Эксперт“»', '21–22.10.2024', { hours: 16, number: '84' })],
  },
  {
    id: 'seitkarym-akerke-erbolovna', slug: 'seitkarym-akerke-erbolovna', fullName: 'Сейткарым Акерке Ерболовна',
    published: true, verificationStatus: 'VERIFIED', profileUrl: '/experts/seitkarym-akerke-erbolovna', specialization: ['Оценка неопределенности измерений по РМГ 43-2001'],
    credentials: [credential('Оценка неопределенности измерений в соответствии с требованиями РМГ 43-2001', 'Сертификат', 'Учебный центр «Эксперт»', '25–26.09.2020', { hours: 16, number: '103' })],
  },
  {
    id: 'seitkarym-akerke-erbolkyzy', slug: 'seitkarym-akerke-erbolkyzy', fullName: 'Сейткарым Акерке Ерболқызы',
    published: true, verificationStatus: 'VERIFIED', profileUrl: '/experts/seitkarym-akerke-erbolkyzy', specialization: [clever],
    credentials: [credential(clever, 'Сертификат пользователя', 'ТОО «Центр охраны здоровья и экопроектирования»', '06.08.2020', { number: 'С-20/06-17/006' })],
  },
  {
    id: 'makhanova-kamilla-maratovna', slug: 'makhanova-kamilla-maratovna', fullName: 'Маханова Камилла Маратовна',
    published: true, verificationStatus: 'VERIFIED', profileUrl: '/experts/makhanova-kamilla-maratovna', specialization: [clever],
    credentials: [credential(clever, 'Сертификат пользователя', 'ТОО «Центр охраны здоровья и экопроектирования»', '06.08.2020', { number: 'С-20/06-17/005' })],
  },
];

export const isVerifiedCmsExpert = (expert: CmsExpertDto | null | undefined): expert is CmsExpertDto => Boolean(
  expert?.verificationStatus === 'VERIFIED' && expert.id?.trim() && expert.fullName?.trim()
  && expert.profileUrl?.trim() && expert.specializations?.length,
);

export const isPublishableExpert = (expert: Expert | null | undefined): expert is Expert => Boolean(
  expert?.published && expert.verificationStatus === 'VERIFIED' && expert.id.trim() && expert.fullName.trim()
  && expert.slug.trim() && expert.profileUrl.trim() && expert.specialization.length,
);
export const isExpertWithCredentials = (expert: Expert | null | undefined): expert is Expert =>
  Boolean(isPublishableExpert(expert) && expert.credentials.length);

export const experts = confirmedExperts.filter(isExpertWithCredentials);
export const expertMap = new Map(experts.map((item) => [item.id, item]));
export const expertProfileMap = new Map(experts.map((item) => [item.profileUrl, item]));
