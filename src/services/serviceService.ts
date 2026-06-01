import { fetcher } from './api';
import type { ServiceItem } from '../types';

const fallbackServices: ServiceItem[] = [
  {
    id: 'ecological-documents',
    businessCompanyId: 'eco-docs',
    title: 'Экологические документы',
    category: 'Проектирование',
    description: 'Разработка экологической документации для предприятий, объектов строительства и действующих производств.',
    forWhom: 'Компании, которым нужны проекты, отчеты и разрешительная документация',
    result: 'Готовый пакет экологических документов',
    includes: ['Консультация', 'Анализ объекта', 'Подготовка документов', 'Сопровождение согласования'],
    documents: ['Карточка компании', 'БИН / ИИН', 'Адрес объекта', 'Исходные данные'],
    workflow: ['Заявка', 'Анализ', 'Документы', 'Согласование', 'Результат'],
    duration: 'от 10 рабочих дней',
    icon: 'file-text',
  },
  {
    id: 'laboratory-tests',
    businessCompanyId: 'eco-lab',
    title: 'Лабораторные анализы',
    category: 'Лаборатория',
    description: 'Отбор проб, замеры, лабораторные исследования и подготовка протоколов.',
    forWhom: 'Предприятиям с производственным экологическим контролем',
    result: 'Протоколы лабораторных исследований',
    includes: ['Согласование замера', 'Выезд', 'Отбор проб', 'Протокол'],
    documents: ['Заявка на замер', 'Схема точек отбора'],
    workflow: ['Согласование', 'Замер', 'Анализ', 'Протокол'],
    duration: '5-10 рабочих дней',
    icon: 'flask',
  },
  {
    id: 'waste-transportation',
    businessCompanyId: 'eco-waste',
    title: 'Вывоз отходов',
    category: 'Отходы',
    description: 'Организация вывоза отходов с объекта с оформлением сопроводительных документов.',
    forWhom: 'Бизнесу, которому нужен регулярный или разовый вывоз отходов',
    result: 'Вывезенные отходы и закрывающие документы',
    includes: ['Расчет объема', 'Подбор транспорта', 'Вывоз', 'Документы'],
    documents: ['Адрес объекта', 'Тип отходов', 'Объем отходов'],
    workflow: ['Заявка', 'Расчет', 'Вывоз', 'Закрытие'],
    duration: '1-3 рабочих дня',
    icon: 'truck',
  },
  {
    id: 'waste-recycling',
    businessCompanyId: 'eco-utilization',
    title: 'Утилизация отходов',
    category: 'Отходы',
    description: 'Передача отходов на утилизацию и оформление подтверждающих документов.',
    forWhom: 'Компаниям, которым важно подтвердить безопасную утилизацию',
    result: 'Акты и документы по утилизации отходов',
    includes: ['Классификация отходов', 'Прием', 'Утилизация', 'Акт'],
    documents: ['Тип отходов', 'Объем', 'Данные компании'],
    workflow: ['Заявка', 'Прием', 'Утилизация', 'Документы'],
    duration: 'от 3 рабочих дней',
    icon: 'recycle',
  },
];

export const getServices = async (): Promise<ServiceItem[]> => {
  try {
    const services = await fetcher<ServiceItem[]>('/services');
    if (Array.isArray(services) && services.length) return services;
  } catch {
    if (!import.meta.env.DEV) throw new Error('Не удалось загрузить услуги');
  }
  return import.meta.env.DEV ? fallbackServices : [];
};

export const getServiceById = async (id: string): Promise<ServiceItem | undefined> => {
  try {
    return await fetcher<ServiceItem>(`/services/${id}`);
  } catch {
    if (!import.meta.env.DEV) throw new Error('Не удалось загрузить услугу');
  }
  return import.meta.env.DEV ? fallbackServices.find((service) => service.id === id) : undefined;
};
