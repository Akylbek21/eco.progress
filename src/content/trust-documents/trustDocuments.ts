import type { TrustDocument } from '../types';

export const trustDocuments: TrustDocument[] = [
  { id: 'design-license', title: 'Лицензия на проектирование — файл для проверки', documentType: 'license', fileUrl: '/docs/permits/лицензия на проектирование экология.pdf', publicDescription: 'Скан документа размещён в проекте. Номер, владелец и срок действия должны быть подтверждены ответственным сотрудником до публикации реквизитов.', verificationStatus: 'requires-verification' },
  { id: 'lab-attestation-ru', title: 'Аттестат лаборатории — русская версия', documentType: 'accreditation', fileUrl: '/docs/permits/Аттестат TCG на русс.pdf', publicDescription: 'Файл доступен для внутренней проверки. Публичные реквизиты пока не подтверждены.', verificationStatus: 'requires-verification' },
  { id: 'waste-permit', title: 'Разрешение по обращению с отходами — файл для проверки', documentType: 'permit', fileUrl: '/docs/permits/разрешение Алеана Сервис новый.pdf', publicDescription: 'Необходимо подтвердить владельца, область действия и актуальный срок перед публикацией.', verificationStatus: 'requires-verification' },
];
