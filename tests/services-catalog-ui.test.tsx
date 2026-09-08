// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ServicesPage from '../src/pages/ServicesPage';
import { ToastProvider } from '../src/components/ui/ToastProvider';

vi.mock('../src/services/api', () => ({ default: { get: vi.fn() } }));
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }) });
afterEach(cleanup);

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ToastProvider><MemoryRouter><ServicesPage /></MemoryRouter></ToastProvider>
  </QueryClientProvider>,
);

describe('service catalog navigation', () => {
  it('groups concrete services and keeps overview pages outside the card grid', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Экологическое проектирование', level: 2 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Разрешения', level: 2 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Лабораторные исследования', level: 2 })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Обзор: Экологические документы' }).getAttribute('href')).toBe('/services/ecological-documents');
    expect(screen.queryByText('Выберите услуги внутри направления')).toBeNull();
  });

  it('searches abbreviations and passes the selected service to the existing order flow', async () => {
    renderPage();
    const search = await screen.findByPlaceholderText('Найти услугу: НДВ, ПЭК, анализ воды…');
    fireEvent.change(search, { target: { value: 'НДВ' } });
    expect(screen.getByRole('heading', { name: 'Проект нормативов допустимых выбросов', level: 3 })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Лабораторный анализ воды', level: 3 })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Рассчитать стоимость НДВ' }));
    await waitFor(() => expect(screen.getByText('Получить консультацию эколога')).toBeTruthy());
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Написать в WhatsApp/ }).some((link) => decodeURIComponent(link.getAttribute('href') || '').includes('Проект нормативов допустимых выбросов'))).toBe(true));
  });

  it('shows a useful empty search state and can reset it', async () => {
    renderPage();
    fireEvent.change(await screen.findByPlaceholderText('Найти услугу: НДВ, ПЭК, анализ воды…'), { target: { value: 'несуществующая услуга' } });
    expect(screen.getByRole('heading', { name: 'Услуги не найдены' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Показать все услуги' }));
    expect(screen.getByRole('heading', { name: 'Проект нормативов допустимых выбросов', level: 3 })).toBeTruthy();
  });
});
