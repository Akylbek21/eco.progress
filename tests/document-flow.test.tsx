// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import api from '../src/services/api';
import { documentFlowApi } from '../src/features/document-flow/api/documentFlowApi';
import { mapCreateDocumentPayload, mapSearchParamsToDocumentFilters } from '../src/features/document-flow/mappers/documentMappers';
import { canMutate, hasFeature, limitProgress, validateDocumentFile, validateRequiredCount } from '../src/features/document-flow/model/access';
import type { AccessContext } from '../src/features/document-flow/model/types';
import SigningRouteBuilder from '../src/features/document-flow/components/SigningRouteBuilder';
import DocumentStatusBadge from '../src/features/document-flow/components/DocumentStatusBadge';

const server = setupServer();
const originalBaseUrl = api.defaults.baseURL;
const access = (extra: Partial<AccessContext> = {}): AccessContext => ({
  available: true,
  readOnly: false,
  status: 'ACTIVE',
  plan: { code: 'PRO', name: 'Pro' },
  startsAt: null,
  expiresAt: null,
  daysRemaining: null,
  features: ['DOCUMENT_FLOW', 'DOCUMENT_CREATE', 'SEQUENTIAL_SIGNING'],
  permissions: ['VIEW_DOCUMENTS', 'CREATE_DOCUMENT'],
  limits: { DOCUMENTS_CREATED: 10 },
  usage: { DOCUMENTS_CREATED: 4 },
  availableActions: [],
  reason: null,
  ...extra,
});

beforeAll(() => {
  api.defaults.baseURL = 'http://localhost/api';
  localStorage.setItem('eco-progress-token', 'secret-token');
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => {
  api.defaults.baseURL = originalBaseUrl;
  localStorage.clear();
  server.close();
});

describe('document flow access and mappers', () => {
  it('enforces access, read-only, permission and feature gates', () => {
    expect(canMutate(access(), 'CREATE_DOCUMENT', 'DOCUMENT_CREATE')).toBe(true);
    expect(canMutate(access({ readOnly: true }), 'CREATE_DOCUMENT', 'DOCUMENT_CREATE')).toBe(false);
    expect(canMutate(access({ available: false }), 'CREATE_DOCUMENT', 'DOCUMENT_CREATE')).toBe(false);
    expect(hasFeature(access(), 'MIXED_SIGNING')).toBe(false);
  });

  it('maps backend list filters including the current-user action filter', () => {
    const filters = mapSearchParamsToDocumentFilters(new URLSearchParams('query= act &direction=OUTGOING&requiresMySignature=true&page=2&size=50'));
    expect(filters).toMatchObject({ query: 'act', direction: 'OUTGOING', page: 2, size: 50 });
    expect(filters.requiresMySignature).toBe(true);
  });

  it('creates the exact metadata payload and preserves optional IDs', () => {
    expect(mapCreateDocumentPayload({
      documentType: 'CONTRACT',
      direction: 'OUTGOING',
      title: ' Contract ',
      counterpartyId: '12',
      organizationId: '3',
    })).toEqual({
      documentType: 'CONTRACT',
      direction: 'OUTGOING',
      title: 'Contract',
      description: undefined,
      counterpartyId: 12,
      signingDeadline: undefined,
      organizationId: 3,
    });
  });

  it('validates requiredCount, usage and document file restrictions', () => {
    expect(validateRequiredCount(2, 2)).toBe(true);
    expect(validateRequiredCount(0, 2)).toBe(false);
    expect(limitProgress(access(), 'DOCUMENTS_CREATED')).toEqual({ used: 4, limit: 10, percent: 40 });
    const config = {
      type: 'CONTRACT' as const, title: 'Contract', allowedDirections: 'BOTH' as const,
      requiredFeature: null, allowedMimeTypes: ['application/pdf'], maxSizeBytes: 10,
      signingRequired: true, counterpartyRequired: true, active: true,
    };
    expect(validateDocumentFile(new File(['123'], 'a.pdf', { type: 'application/pdf' }), config)).toBeNull();
    expect(validateDocumentFile(new File(['123'], 'a.exe', { type: 'application/octet-stream' }), config)).toContain('Тип файла');
    expect(validateDocumentFile(new File(['12345678901'], 'a.pdf', { type: 'application/pdf' }), config)).toContain('Размер файла');
  });
});

describe('document flow secure commands and components', () => {
  it('uses one idempotency key for document creation', async () => {
    let header = '';
    server.use(http.post('http://localhost/api/document-flow/documents', ({ request }) => {
      header = request.headers.get('Idempotency-Key') || '';
      return HttpResponse.json({ data: { id: 7 } });
    }));
    await documentFlowApi.createDocument({ documentType: 'CONTRACT', direction: 'OUTGOING', title: 'A' }, 'stable-key');
    expect(header).toBe('stable-key');
  });

  it('never sends private key material in signature payload', async () => {
    let body: Record<string, unknown> = {};
    server.use(http.post('http://localhost/api/document-flow/documents/7/signatures', async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ data: { id: 1 } });
    }));
    const unsafe = { documentId: 7, versionId: 2, assignmentId: 3, cms: 'cms', clientRequestId: 'request', privateKey: 'secret', password: 'secret', pkcs12: 'secret' };
    await documentFlowApi.submitSignature(7, unsafe);
    expect(body).toEqual({ documentId: 7, versionId: 2, assignmentId: 3, cms: 'cms', clientRequestId: 'request' });
  });

  it('downloads the signed package as a backend blob', async () => {
    const blob = new Blob(['zip'], { type: 'application/zip' });
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: blob });
    const response = await documentFlowApi.signedPackage(7);
    expect(response.data).toBeInstanceOf(Blob);
    expect(get).toHaveBeenCalledWith('/document-flow/documents/7/signed-package', { responseType: 'blob' });
  });

  it('hides MIXED without feature and exposes unknown status as incompatible', () => {
    render(<SigningRouteBuilder access={access()} value={{ routeType: 'SEQUENTIAL', steps: [] }} onChange={() => undefined} />);
    expect(screen.queryByText('MIXED')).toBeNull();
    cleanup();
    render(<DocumentStatusBadge status="BACKEND_NEW_STATUS" />);
    expect(screen.getByText(/Неизвестный статус/)).toBeTruthy();
  });
});
