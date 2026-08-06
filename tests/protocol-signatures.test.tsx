// @vitest-environment jsdom

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ProtocolSignaturesCard from '../src/features/protocols/details/ProtocolSignaturesCard';
import {
  protocolSignErrorMessage,
  useSignProtocolMutation,
} from '../src/features/protocols/hooks/useSignProtocolMutation';
import api from '../src/services/api';
import protocolService from '../src/services/protocolService';
import { signProtocol } from '../src/services/apiProtocolService';
import type { Protocol } from '../src/types/protocols';
import { getProtocolPermissions } from '../src/utils/protocolPermissions';

vi.mock('../src/features/protocols/utils/protocolSigning', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/features/protocols/utils/protocolSigning')>();
  return { ...actual, createProtocolCmsSignature: vi.fn().mockResolvedValue('cms-base64') };
});

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
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.spyOn(protocolService, 'downloadPdf').mockResolvedValue({
    blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
    fileName: 'protocol.pdf',
  });
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
  hasPdf: true,
  pdfFileId: 'pdf-42',
  permissions: { canSign: true, canEdit: true, canGenerateDocuments: true },
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

const signedProtocol = protocol({
    status: 'SIGNED',
    version: 13,
    signatureCount: 1,
    maxSignatures: 5,
    signedByCurrentUser: true,
    signatures: [{
      id: 101,
      userId: 7,
      signerFullName: 'Ажибек Акылбек Бауыржанулы',
      signerPosition: 'Лаборант',
      signedAt: '2026-07-27T13:20:00+05:00',
    }],
});

const successResponse = { data: signedProtocol };

const SigningHarness = () => {
  const [item, setItem] = useState(protocol());
  const mutation = useSignProtocolMutation(item.id, {
    onSigned: setItem,
  });
  return (
    <>
      <ProtocolSignaturesCard
        protocol={item}
        permissions={getProtocolPermissions(item, 'STAFF')}
        signing={mutation.isPending}
        onSign={() => mutation.sign({ protocol: item })}
      />
      <output aria-label="Статус протокола">{item.status}</output>
    </>
  );
};

describe('collective protocol signing API and mutation', () => {
  it('posts only CMS and never sends version or a user identity', async () => {
    let body: Record<string, unknown> = {};
    let ifMatch = '';
    server.use(
      http.post('http://localhost/api/protocols/42/sign', async ({ request }) => {
        body = await request.json() as Record<string, unknown>;
        ifMatch = request.headers.get('If-Match') || '';
        return HttpResponse.json(successResponse);
      }),
    );

    const response = await signProtocol(42, { cmsSignatureBase64: 'cms-base64' });

    expect(body).toEqual({ cmsSignatureBase64: 'cms-base64' });
    expect(ifMatch).toBe('');
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('signerFullName');
    expect(response.status).toBe('SIGNED');
  });

  it('blocks double click, updates the signature UI and invalidates protocol queries', async () => {
    let requestCount = 0;
    server.use(
      http.get('http://localhost/api/protocols/42', () => HttpResponse.json({ data: protocol({ permissions: { canSign: true } }) })),
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
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['protocols', 'backend-resolved:unauthenticated', 'list'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['protocols', 'backend-resolved:unauthenticated', 'detail', '42', 'signatures'] });
    });
  });
});

describe('signature card states and locking', () => {
  it('allows another employee to sign an already SIGNED protocol', () => {
    const item = protocol({
      status: 'SIGNED',
      signatureCount: 1,
      signatures: [signedProtocol.signatures[0]],
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
        protocol={protocol({ permissions: {} })}
        permissions={getProtocolPermissions(protocol({ permissions: {} }), 'CLIENT')}
        onSign={vi.fn()}
      />,
    );
    expect((screen.getByRole('button', { name: 'Подписать' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('У вас нет доступа к подписанию протокола')).toBeTruthy();
  });

  it('uses backend permissions without local status or role aliases', () => {
    const item = protocol({
      status: 'SIGNED',
      signatureCount: 1,
      permissions: {
        canEdit: true,
        canCalculate: true,
        canGenerateDocuments: true,
        canCreateCorrection: true,
        canSign: true,
      },
    });
    expect(getProtocolPermissions(item, 'MANAGER')).toMatchObject({
      canEdit: true,
      canCalculate: true,
      canGenerateDocuments: true,
      canReplace: true,
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
        signedProtocol.signatures[0],
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
