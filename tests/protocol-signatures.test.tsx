// @vitest-environment jsdom

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ProtocolSignaturesCard from '../src/features/protocols/details/ProtocolSignaturesCard';
import ProtocolActionsMenu from '../src/features/protocols/details/ProtocolActionsMenu';
import ProtocolDocumentsTab from '../src/features/protocols/details/ProtocolDocumentsTab';
import {
  PROTOCOL_STALE_PDF_MESSAGE,
  protocolSignErrorMessage,
  useSignProtocolMutation,
} from '../src/features/protocols/hooks/useSignProtocolMutation';
import api from '../src/services/api';
import protocolService from '../src/services/protocolService';
import { signProtocol } from '../src/services/apiProtocolService';
import type { Protocol } from '../src/types/protocols';
import { hasProtocolAction } from '../src/features/protocols/utils/protocolActions';

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
  vi.spyOn(protocolService, 'downloadProtocolDocument').mockResolvedValue({
    blob: new Blob(['%PDF-bytes'], { type: 'application/pdf' }),
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
  availableActions: { sign: true, downloadPdf: true },
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
        actions={item.availableActions}
        signing={mutation.isPending}
        onSign={() => mutation.sign({ protocol: item })}
      />
      <output aria-label="Статус протокола">{item.status}</output>
    </>
  );
};

describe('collective protocol signing API and mutation', () => {
  it('posts CMS with the current version and never sends a user identity', async () => {
    let body: Record<string, unknown> = {};
    let ifMatch = '';
    server.use(
      http.post('http://localhost/api/protocols/42/sign', async ({ request }) => {
        body = await request.json() as Record<string, unknown>;
        ifMatch = request.headers.get('If-Match') || '';
        return HttpResponse.json(successResponse);
      }),
      http.get('http://localhost/api/protocols/42', () => HttpResponse.json(successResponse)),
    );

    const response = await signProtocol(42, { cmsSignatureBase64: 'cms-base64', version: 12 });

    expect(body).toEqual({ cmsSignatureBase64: 'cms-base64', version: 12 });
    expect(ifMatch).toBe('');
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('signerFullName');
    expect(response.status).toBe('SIGNED');
  });

  it('blocks double click, updates the signature UI and invalidates protocol queries', async () => {
    let requestCount = 0;
    let signed = false;
    server.use(
      http.get('http://localhost/api/protocols/42', () => HttpResponse.json(signed ? successResponse : { data: protocol() })),
      http.post('http://localhost/api/protocols/42/sign', async () => {
        requestCount += 1;
        await delay(100);
        signed = true;
        return HttpResponse.json(successResponse);
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(<QueryClientProvider client={queryClient}><SigningHarness /></QueryClientProvider>);

    const button = screen.getByRole('button', { name: 'Подписать ЭЦП' });
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
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['protocols', 'backend-resolved:unauthenticated', 'detail', '42', 'documents'] });
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
        actions={item.availableActions}
        onSign={vi.fn()}
      />,
    );
    expect((screen.getByRole('button', { name: 'Подписать ЭЦП' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('prevents repeat signing, enforces the limit and fails closed without SIGN action', () => {
    const alreadySigned = protocol({ status: 'SIGNED', signatureCount: 1, signedByCurrentUser: true });
    const { rerender } = render(
      <ProtocolSignaturesCard
        protocol={alreadySigned}
        actions={alreadySigned.availableActions}
        onSign={vi.fn()}
      />,
    );
    expect(screen.getByText('Вы подписали этот протокол')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Подписать ЭЦП' })).toBeNull();

    const limit = protocol({ status: 'SIGNED', signatureCount: 5, signedByCurrentUser: false, availableActions: { sign: false } });
    rerender(
      <ProtocolSignaturesCard
        protocol={limit}
        actions={limit.availableActions}
        onSign={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Подписать ЭЦП' })).toBeNull();

    rerender(
      <ProtocolSignaturesCard
        protocol={protocol({ availableActions: {} })}
        actions={{}}
        onSign={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Подписать ЭЦП' })).toBeNull();
  });

  it('uses canonical actions without deriving them from signed status', () => {
    const item = protocol({
      status: 'SIGNED',
      signatureCount: 1,
      availableActions: {
        edit: true,
        calculate: true,
        generateDocx: true,
        createCorrection: true,
        sign: true,
      },
    });
    expect(hasProtocolAction(item, 'edit')).toBe(true);
    expect(hasProtocolAction(item, 'calculate')).toBe(true);
    expect(hasProtocolAction(item, 'generateDocx')).toBe(true);
    expect(hasProtocolAction(item, 'createCorrection')).toBe(true);
    expect(hasProtocolAction(item, 'sign')).toBe(true);
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
        actions={item.availableActions}
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
        actions={item.availableActions}
        loading
        onSign={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Загрузка подписей')).toBeTruthy();
    rerender(
      <ProtocolSignaturesCard
        protocol={item}
        actions={item.availableActions}
        onSign={vi.fn()}
      />,
    );
    expect(screen.getByText('Протокол ещё не подписан')).toBeTruthy();
    expect(screen.queryByText('42')).toBeNull();
  });
});

describe('canonical protocol document and workflow actions', () => {
  const callbacks = {
    onDocx: vi.fn(), onGenerateDocx: vi.fn(), onGeneratePdf: vi.fn(), onCorrection: vi.fn(),
    onReturnForRevision: vi.fn(), onCancel: vi.fn(), onArchive: vi.fn(), onHistory: vi.fn(),
  };

  it('connects returnToDraft, viewAudit and format-specific initial generation actions', () => {
    const item = protocol({ hasDocx: false, hasPdf: false });
    render(<ProtocolActionsMenu protocol={item} actions={{ returnToDraft: true, viewAudit: true, generateDocx: true, generatePdf: true } as never} busy={false} {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
    expect(screen.getByRole('button', { name: 'Вернуть в черновик' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Посмотреть историю' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сгенерировать DOCX' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сгенерировать PDF' })).toBeTruthy();
  });

  it('shows correction for SIGNED and hides history when viewAudit is false', () => {
    const item = protocol({ status: 'SIGNED' });
    render(<ProtocolActionsMenu protocol={item} actions={{ createCorrection: true, viewAudit: false } as never} busy={false} {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
    expect(screen.getByRole('button', { name: 'Создать исправленную версию' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Посмотреть историю' })).toBeNull();
  });

  it('does not regenerate APPROVED documents unless backend explicitly allows each action', () => {
    const item = protocol({ status: 'APPROVED', hasDocx: true, hasPdf: true });
    const documentCallbacks = { onPreview: vi.fn(), onGenerateDocx: vi.fn(), onGeneratePdf: vi.fn(), onDocx: vi.fn(), onPdf: vi.fn(), onSign: vi.fn() };
    const { rerender } = render(<ProtocolDocumentsTab protocol={item} busy={false} actions={{} as never} {...documentCallbacks} />);
    expect(screen.queryByRole('button', { name: 'Перегенерировать DOCX' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Перегенерировать PDF' })).toBeNull();

    rerender(<ProtocolDocumentsTab protocol={item} busy={false} actions={{ regenerateDocx: true, regeneratePdf: true } as never} {...documentCallbacks} />);
    expect(screen.getByRole('button', { name: 'Перегенерировать DOCX' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Перегенерировать PDF' })).toBeTruthy();
  });
});

describe('collective signing errors', () => {
  it.each([
    ['OPTIMISTIC_LOCK_CONFLICT', 'Протокол был изменён другим сотрудником. Обновите данные'],
    ['PROTOCOL_ALREADY_SIGNED', 'Вы уже подписали эту версию протокола'],
    ['SIGNATURE_LIMIT_REACHED', 'Достигнуто максимальное количество подписей: 5'],
  ])('maps %s to a clear message', (code, message) => {
    expect(protocolSignErrorMessage({
      isAxiosError: true,
      response: { status: 409, data: { code } },
    })).toBe(message);
  });

  it.each(['PROTOCOL_CONTENT_CHANGED', 'PDF_STALE', 'PDF_CONTENT_VERSION_MISMATCH', 'APPROVED_PDF_HASH_MISMATCH'])(
    'blocks SIGN with the stale PDF message for %s',
    (code) => {
      expect(protocolSignErrorMessage({ isAxiosError: true, response: { status: 409, data: { code } } })).toBe(PROTOCOL_STALE_PDF_MESSAGE);
    },
  );
});
