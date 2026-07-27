// @vitest-environment jsdom

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import ProtocolSignaturesCard from '../src/features/protocols/details/ProtocolSignaturesCard';
import {
  protocolSignErrorMessage,
  useSignProtocolMutation,
} from '../src/features/protocols/hooks/useSignProtocolMutation';
import api from '../src/services/api';
import { signProtocol } from '../src/services/apiProtocolService';
import type { Protocol, SignProtocolResponse } from '../src/types/protocols';
import { getProtocolPermissions } from '../src/utils/protocolPermissions';

const server = setupServer();
const originalBaseUrl = api.defaults.baseURL;

beforeAll(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
  api.defaults.baseURL = 'http://localhost/api';
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  api.defaults.baseURL = originalBaseUrl;
  server.close();
  vi.unstubAllGlobals();
});

const protocol = (extra: Partial<Protocol> = {}): Protocol => ({
  id: '42',
  protocolNumber: 'P-42',
  templateId: 'ambient_air',
  status: 'APPROVED',
  version: 12,
  signatureCount: 0,
  maxSignatures: 5,
  signedByCurrentUser: false,
  signatures: [],
  permissions: { canSign: true, canEdit: true, canSave: true, canGenerate: true },
  companySnapshot: { companyName: 'Eco', objectName: 'Object' },
  protocolDate: '2026-07-27',
  organization: { organizationName: '', organizationAddress: '', objectName: '', productName: '', testingBasis: '' },
  laboratory: { laboratoryName: '', laboratoryAddress: '', accreditationNumber: '', accreditationValidUntil: '', director: '', laboratoryHead: '', executor: '' },
  testing: { productNormativeDocument: '', samplingMethodDocument: '', testingMethodDocument: '', samplingDate: '', testingStartDate: '', testingEndDate: '', testingDate: '', testingPurpose: '', environmentConditions: '' },
  results: [],
  measurementDevices: [],
  history: [],
  createdAt: '',
  updatedAt: '',
  ...extra,
});

const successResponse: SignProtocolResponse = {
  success: true,
  message: 'signed',
  data: {
    protocolId: 42,
    status: 'SIGNED',
    version: 13,
    signatureCount: 1,
    maxSignatures: 5,
    signedByCurrentUser: true,
    signature: {
      id: 101,
      userId: 7,
      signerFullName: 'Ажибек Акылбек Бауыржанулы',
      signerPosition: 'Лаборант',
      signedAt: '2026-07-27T13:20:00+05:00',
    },
  },
};

const SigningHarness = () => {
  const [item, setItem] = useState(protocol());
  const mutation = useSignProtocolMutation(item.id, {
    onSigned: (response) => {
      setItem((current) => ({
        ...current,
        status: response.data.status,
        version: response.data.version,
        signatureCount: response.data.signatureCount,
        maxSignatures: response.data.maxSignatures,
        signedByCurrentUser: response.data.signedByCurrentUser,
        signatures: [...current.signatures, response.data.signature],
      }));
    },
  });
  return (
    <>
      <ProtocolSignaturesCard
        protocol={item}
        permissions={getProtocolPermissions(item, 'STAFF')}
        signing={mutation.isPending}
        onSign={() => mutation.sign({ protocolId: item.id, version: item.version || 0 })}
      />
      <output aria-label="Статус протокола">{item.status}</output>
    </>
  );
};

describe('collective protocol signing API and mutation', () => {
  it('posts only the current version and never sends a user identity', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post('http://localhost/api/protocols/42/sign', async ({ request }) => {
        body = await request.json() as Record<string, unknown>;
        return HttpResponse.json(successResponse);
      }),
    );

    const response = await signProtocol(42, 12);

    expect(body).toEqual({ version: 12 });
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('signerFullName');
    expect(response.data.status).toBe('SIGNED');
  });

  it('blocks double click, updates the signature UI and invalidates protocol queries', async () => {
    let requestCount = 0;
    server.use(
      http.post('http://localhost/api/protocols/42/sign', async () => {
        requestCount += 1;
        await delay(100);
        return HttpResponse.json(successResponse);
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(<QueryClientProvider client={queryClient}><SigningHarness /></QueryClientProvider>);

    const button = screen.getByRole('button', { name: 'Подписать' });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect((screen.getByRole('button', { name: 'Подписание…' }) as HTMLButtonElement).disabled).toBe(true));
    expect(await screen.findByText('Вы подписали этот протокол')).toBeTruthy();
    expect(screen.getByText('Подписей: 1 из 5')).toBeTruthy();
    expect(screen.getByLabelText('Статус протокола').textContent).toBe('SIGNED');
    expect(screen.getByText('Ажибек Акылбек Бауыржанулы')).toBeTruthy();
    expect(requestCount).toBe(1);
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['protocols'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['protocol-signatures', '42'] });
    });
  });
});

describe('signature card states and locking', () => {
  it('allows another employee to sign an already SIGNED protocol', () => {
    const item = protocol({
      status: 'SIGNED',
      signatureCount: 1,
      signatures: [successResponse.data.signature],
      signedByCurrentUser: false,
    });
    render(
      <ProtocolSignaturesCard
        protocol={item}
        permissions={getProtocolPermissions(item, 'LABORATORY')}
        onSign={vi.fn()}
      />,
    );
    expect((screen.getByRole('button', { name: 'Подписать' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('prevents repeat signing, enforces the limit and excludes CLIENT', () => {
    const alreadySigned = protocol({ status: 'SIGNED', signatureCount: 1, signedByCurrentUser: true });
    const { rerender } = render(
      <ProtocolSignaturesCard
        protocol={alreadySigned}
        permissions={getProtocolPermissions(alreadySigned, 'STAFF')}
        onSign={vi.fn()}
      />,
    );
    expect(screen.getByText('Вы подписали этот протокол')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Подписать' })).toBeNull();

    const limit = protocol({ status: 'SIGNED', signatureCount: 5, signedByCurrentUser: false });
    rerender(
      <ProtocolSignaturesCard
        protocol={limit}
        permissions={getProtocolPermissions(limit, 'STAFF')}
        onSign={vi.fn()}
      />,
    );
    expect(screen.getByText('Достигнуто максимальное количество подписей: 5')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Подписать' }) as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <ProtocolSignaturesCard
        protocol={protocol()}
        permissions={getProtocolPermissions(protocol(), 'CLIENT')}
        onSign={vi.fn()}
      />,
    );
    expect((screen.getByRole('button', { name: 'Подписать' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('У вас нет доступа к подписанию протокола')).toBeTruthy();
  });

  it('locks all content mutations after the first signature but preserves correction permission', () => {
    const item = protocol({
      status: 'SIGNED',
      signatureCount: 1,
      permissions: {
        canEdit: true,
        canSave: true,
        canCalculate: true,
        canGenerate: true,
        canCreateCorrection: true,
        canSign: true,
      },
    });
    expect(getProtocolPermissions(item, 'MANAGER')).toMatchObject({
      canEdit: false,
      canSave: false,
      canCalculate: false,
      canGenerate: false,
      canCreateCorrection: true,
      canSign: true,
    });
  });

  it('sorts signatures by signedAt and omits an absent position', () => {
    const item = protocol({
      status: 'SIGNED',
      signatureCount: 2,
      signatures: [
        {
          id: 2,
          userId: 2,
          signerFullName: 'Второй сотрудник',
          signerPosition: null,
          signedAt: '2026-07-27T13:32:00+05:00',
        },
        successResponse.data.signature,
      ],
    });
    render(
      <ProtocolSignaturesCard
        protocol={item}
        permissions={getProtocolPermissions(item, 'STAFF')}
        onSign={vi.fn()}
      />,
    );
    const names = screen.getAllByRole('listitem').map((row) => row.querySelector('p')?.textContent);
    expect(names).toEqual(['Ажибек Акылбек Бауыржанулы', 'Второй сотрудник']);
    expect(screen.queryByText('null')).toBeNull();
  });

  it('shows skeleton and the empty state without exposing internal ids', () => {
    const item = protocol();
    const { rerender } = render(
      <ProtocolSignaturesCard
        protocol={item}
        permissions={getProtocolPermissions(item, 'STAFF')}
        loading
        onSign={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Загрузка подписей')).toBeTruthy();
    rerender(
      <ProtocolSignaturesCard
        protocol={item}
        permissions={getProtocolPermissions(item, 'STAFF')}
        onSign={vi.fn()}
      />,
    );
    expect(screen.getByText('Протокол ещё не подписан')).toBeTruthy();
    expect(screen.queryByText('42')).toBeNull();
  });
});

describe('collective signing errors', () => {
  it.each([
    ['PROTOCOL_VERSION_CONFLICT', 'Протокол был изменён другим сотрудником. Обновите данные'],
    ['PROTOCOL_ALREADY_SIGNED', 'Вы уже подписали эту версию протокола'],
    ['SIGNATURE_LIMIT_REACHED', 'Достигнуто максимальное количество подписей: 5'],
  ])('maps %s to a clear message', (code, message) => {
    expect(protocolSignErrorMessage({
      isAxiosError: true,
      response: { status: 409, data: { code } },
    })).toBe(message);
  });
});
