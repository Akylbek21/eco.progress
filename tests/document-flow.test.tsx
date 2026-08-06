// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import api from '../src/services/api';
import { documentFlowApi, publicDocumentFlowApi } from '../src/features/document-flow/api/documentFlowApi';
import {
  mapCreateDocumentPayload, mapSearchParamsToDocumentFilters, resetDocumentFilterParams, setDocumentFilterParam,
} from '../src/features/document-flow/mappers/documentMappers';
import { canMutate, hasFeature, limitProgress, validateDocumentFile, validateRequiredCount } from '../src/features/document-flow/model/access';
import type { AccessContext } from '../src/features/document-flow/model/types';
import SigningRouteBuilder from '../src/features/document-flow/components/SigningRouteBuilder';
import DocumentStatusBadge from '../src/features/document-flow/components/DocumentStatusBadge';
import { toAccessRequestPayload } from '../src/features/document-flow/components/AccessRequestForm';
import { emptyToUndefined, isValidEmail, isValidPhone, normalizeBin } from '../src/features/document-flow/utils/counterpartyForm';
import {
  createCreationCheckpoint, runCreationWorkflow, type CreationStage, type CreationWorkflowOperations,
} from '../src/features/document-flow/model/creationCheckpoint';
import type { DocumentAttachment, DocumentDetail, DocumentVersion, SigningRoute } from '../src/features/document-flow/model/types';
import { resolveDocumentActions } from '../src/features/document-flow/model/documentActions';
import {
  accessContextSchema, apiErrorSchema, documentDetailSchema, documentListItemSchema,
  documentFlowOrganizationsSchema, publicInvitationSchema, signingAssignmentSchema, signingRouteSchema,
} from '../src/features/document-flow/api/contractSchemas';

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
const detailDto = (extra: Record<string, unknown> = {}) => ({
  id: 7, publicId: 'public-7', number: null, title: 'A', description: null, type: 'CONTRACT',
  direction: 'OUTGOING', counterparty: null, author: null, createdAt: '2026-08-03T10:00:00',
  updatedAt: '2026-08-03T10:00:00', deadline: null, status: 'DRAFT', currentVersionId: null,
  version: 1,
  permissions: {
    canView: true, canEdit: true, canDelete: true, canSend: false, canDownload: false,
    canUploadVersion: true, canArchive: false, canManageAttachments: true,
  },
  availableActions: ['EDIT', 'DELETE', 'UPLOAD_VERSION', 'MANAGE_ATTACHMENTS'],
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
  it('validates Java DTO examples at the API boundary', () => {
    expect(accessContextSchema.parse(access()).available).toBe(true);
    expect(accessContextSchema.parse(access({
      available: false,
      readOnly: true,
      status: null,
      plan: null,
      internalMode: true,
      organizationId: 2,
      role: 'OWNER',
      membershipStatus: 'INVITED',
      organization: { id: 2, name: 'Администратор ECOPROGRESS GROUP' },
      features: [],
      limits: {},
      usage: {},
      reason: 'Нет активной подписки на модуль документооборота',
      testMode: false,
    })).reason).toBe('Нет активной подписки на модуль документооборота');
    expect(documentDetailSchema.parse(detailDto()).publicId).toBe('public-7');
    expect(documentListItemSchema.parse({
      id: 7, number: null, title: 'A', type: 'CONTRACT', direction: 'OUTGOING', counterparty: null,
      author: null, createdAt: '2026-08-03T10:00:00', updatedAt: '2026-08-03T10:00:00', deadline: null, status: 'DRAFT',
      signedCount: 0, requiredCount: 0, rejectedCount: 0, requiresMySignature: false, version: 1,
      permissions: detailDto().permissions, availableActions: ['EDIT'],
    }).signedCount).toBe(0);
    const assignment = {
      id: 3, stepId: 2, signerType: 'ORGANIZATION_MEMBER', memberId: 5, signerFullName: null,
      organizationName: null, organizationBin: null, email: null, phone: null, roleCode: 'SIGNER',
      required: true, status: 'AVAILABLE', availableAt: null, viewedAt: null, signedAt: null,
      rejectedAt: null, rejectionReason: null, invitationExpiresAt: null,
    };
    expect(signingAssignmentSchema.parse(assignment).memberId).toBe(5);
    expect(signingRouteSchema.parse({
      id: 9, documentId: 7, routeType: 'SEQUENTIAL', status: 'ACTIVE', createdBy: 1,
      createdAt: '2026-08-03T10:00:00Z', activatedAt: null, completedAt: null, version: 0,
      steps: [{ id: 2, stepOrder: 0, requiredCount: 1, assignments: [assignment] }],
    }).id).toBe(9);
    expect(publicInvitationSchema.parse({
      documentId: 7, documentTitle: 'A', roleCode: null, required: true, status: 'AVAILABLE',
      invitationExpiresAt: null, signingDeadline: null,
    }).documentId).toBe(7);
    expect(apiErrorSchema.parse({ success: false, data: null, message: 'Conflict', code: 'CONFLICT' }).code).toBe('CONFLICT');
    expect(() => publicInvitationSchema.parse({ documentId: 7, documentTitle: 'A' })).toThrow();
  });
  it('enforces access, read-only, permission and feature gates', () => {
    expect(canMutate(access(), 'CREATE_DOCUMENT', 'DOCUMENT_CREATE')).toBe(true);
    expect(canMutate(access({ readOnly: true }), 'CREATE_DOCUMENT', 'DOCUMENT_CREATE')).toBe(false);
    expect(canMutate(access({ available: false }), 'CREATE_DOCUMENT', 'DOCUMENT_CREATE')).toBe(false);
    expect(hasFeature(access(), 'MIXED_SIGNING')).toBe(false);
  });

  it('uses the backend action enum without status-derived fallbacks', () => {
    const resolved = resolveDocumentActions(['DOWNLOAD_SIGNED_PACKAGE', 'SIGN'], ['SIGN']);
    expect(resolved.supportedByFrontend).toEqual(['DOWNLOAD_SIGNED_PACKAGE', 'SIGN']);
    expect(resolved.unavailableBecauseBackendContract).toEqual([]);
    expect(resolved.backendActions).toContain('SIGN');
  });

  it('maps backend list filters including the current-user action filter', () => {
    const filters = mapSearchParamsToDocumentFilters(new URLSearchParams('query= act &direction=OUTGOING&requiresMySignature=true&page=2&size=50'));
    expect(filters).toMatchObject({ query: 'act', direction: 'OUTGOING', page: 2, size: 50 });
    expect(filters.requiresMySignature).toBe(true);
  });

  it('writes, restores and resets URL filters without empty parameters', () => {
    let params = new URLSearchParams('page=4&size=50&sort=title%2Casc');
    params = setDocumentFilterParam(params, 'requiresMySignature', 'true');
    params = setDocumentFilterParam(params, 'direction', 'OUTGOING');
    params = setDocumentFilterParam(params, 'query', '   ');
    expect(params.get('page')).toBe('0');
    expect(params.has('query')).toBe(false);
    expect(mapSearchParamsToDocumentFilters(new URLSearchParams(params.toString()))).toMatchObject({
      page: 0, size: 50, sort: 'title,asc', direction: 'OUTGOING', requiresMySignature: true,
    });
    expect(resetDocumentFilterParams(50).toString()).toBe('page=0&size=50&sort=createdAt%2Cdesc');
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
  it('uses the shared client without JWT for public document-flow requests', async () => {
    let authorization: string | null = 'not-called';
    server.use(http.get('http://localhost/api/public/document-flow/plans', ({ request }) => {
      authorization = request.headers.get('Authorization');
      return HttpResponse.json({ success: true, data: [] });
    }));
    await documentFlowApi.plans();
    expect(authorization).toBeNull();
  });

  it('keeps the private CRM session when a public invitation returns 401', async () => {
    localStorage.setItem('eco-progress-token', 'secret-token');
    localStorage.setItem('eco-progress-user', JSON.stringify({ id: '7' }));
    sessionStorage.removeItem('eco-progress-401-redirect');
    server.use(http.get('http://localhost/api/public/document-flow/signing/expired', () =>
      HttpResponse.json({ success: false, code: 'INVITATION_EXPIRED', message: 'Expired' }, { status: 401 }),
    ));
    const { publicDocumentFlowApi } = await import('../src/features/document-flow/api/documentFlowApi');
    await expect(publicDocumentFlowApi.invitation('expired')).rejects.toBeTruthy();
    expect(localStorage.getItem('eco-progress-token')).toBe('secret-token');
    expect(localStorage.getItem('eco-progress-user')).toBe(JSON.stringify({ id: '7' }));
    expect(sessionStorage.getItem('eco-progress-401-redirect')).toBeNull();
  });

  it('rejects a logical backend failure returned with HTTP 200', async () => {
    server.use(http.get('http://localhost/api/public/document-flow/plans', () =>
      HttpResponse.json({ success: false, message: 'Тарифы временно недоступны', data: null }),
    ));
    await expect(documentFlowApi.plans()).rejects.toThrow('Тарифы временно недоступны');
  });

  it.each([400, 403, 404, 409, 412, 422, 500])('preserves the Java ApiResponse error envelope for HTTP %s', async (status) => {
    server.use(http.get('http://localhost/api/public/document-flow/plans', () =>
      HttpResponse.json({
        success: false, data: null, message: `Failure ${status}`, code: `HTTP_${status}`,
        errors: [`Failure ${status}`], fieldErrors: null, traceId: `trace-${status}`,
      }, { status }),
    ));
    await expect(documentFlowApi.plans()).rejects.toMatchObject({
      response: { status, data: { success: false, code: `HTTP_${status}`, traceId: `trace-${status}` } },
    });
  });

  it('loads access and counterparties with the selected organization tenant', async () => {
    const requests: string[] = [];
    const currentAccess = access({
      available: false,
      readOnly: true,
      status: null,
      plan: null,
      internalMode: true,
      organizationId: 2,
      role: 'OWNER',
      membershipStatus: 'INVITED',
      organization: { id: 2, name: 'Администратор ECOPROGRESS GROUP' },
      features: [],
      limits: {},
      usage: {},
      reason: 'Нет активной подписки на модуль документооборота',
      testMode: false,
    });
    server.use(
      http.get('http://localhost/api/document-flow/access', ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json({ success: true, data: currentAccess, message: null });
      }),
      http.get('http://localhost/api/document-flow/counterparties', ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json({ success: true, data: {
          items: [{ id: 1, ownerOrganizationId: 9, linkedOrganizationId: null, bin: '123456789012', name: 'A', status: 'ACTIVE', version: 0 }],
          page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true, hasNext: false, hasPrevious: false,
        }, message: null });
      }),
    );
    const context = await documentFlowApi.access(2);
    const page = await documentFlowApi.getCounterparties({ organizationId: 2, query: 'A', status: 'ACTIVE', sort: 'name,asc', page: 0, size: 20 });
    expect(context).toMatchObject({
      available: false,
      organizationId: 2,
      membershipStatus: 'INVITED',
      reason: 'Нет активной подписки на модуль документооборота',
    });
    expect(page.items[0].organizationId).toBe(9);
    expect(requests).toEqual([
      'http://localhost/api/document-flow/access?organizationId=2',
      'http://localhost/api/document-flow/counterparties?organizationId=2&query=A&status=ACTIVE&sort=name,asc&page=0&size=20',
    ]);
  });

  it('forms the document-list backend query once with boolean and sorting', async () => {
    let calls = 0;
    let seen = '';
    server.use(http.get('http://localhost/api/document-flow/documents', ({ request }) => {
      calls += 1;
      seen = new URL(request.url).search;
      return HttpResponse.json({ success: true, data: {
        items: [], page: 0, size: 20, totalElements: 0, totalPages: 0,
        first: true, last: true, hasNext: false, hasPrevious: false,
      } });
    }));
    await documentFlowApi.documents({ page: 0, size: 20, sort: 'createdAt,desc', requiresMySignature: true });
    expect(calls).toBe(1);
    expect(new URLSearchParams(seen).get('requiresMySignature')).toBe('true');
    expect(new URLSearchParams(seen).get('sort')).toBe('createdAt,desc');
  });

  it('creates and archives a counterparty in the selected organization', async () => {
    const seen: Array<{ url: string; body?: Record<string, unknown> }> = [];
    const dto = { id: 2, ownerOrganizationId: 9, linkedOrganizationId: null, bin: '123456789012', name: 'A', status: 'ACTIVE', version: 0 };
    server.use(
      http.post('http://localhost/api/document-flow/counterparties', async ({ request }) => {
        seen.push({ url: request.url, body: await request.json() as Record<string, unknown> });
        return HttpResponse.json({ success: true, data: dto, message: null });
      }),
      http.delete('http://localhost/api/document-flow/counterparties/2', ({ request }) => {
        seen.push({ url: request.url });
        return HttpResponse.json({ success: true, data: { ...dto, status: 'ARCHIVED' }, message: null });
      }),
    );
    await documentFlowApi.createCounterparty({ organizationId: 9, bin: '123456789012', name: 'A' });
    await documentFlowApi.archiveCounterparty(2, 9);
    expect(seen[0]).toEqual({
      url: 'http://localhost/api/document-flow/counterparties',
      body: { organizationId: 9, bin: '123456789012', name: 'A' },
    });
    expect(seen[1].url).toBe('http://localhost/api/document-flow/counterparties/2?organizationId=9');
  });

  it('normalizes and validates counterparty form values', () => {
    expect(normalizeBin('12 34-56.789/0123')).toBe('123456789012');
    expect(normalizeBin('123')).toHaveLength(3);
    expect(emptyToUndefined('   ')).toBeUndefined();
    expect(emptyToUndefined(' Director ')).toBe('Director');
    expect(isValidEmail('mail@example.kz')).toBe(true);
    expect(isValidEmail('bad-email')).toBe(false);
    expect(isValidPhone('+7 (701) 123-45-67')).toBe(true);
    expect(isValidPhone('abc')).toBe(false);
  });

  it('uses one idempotency key for document creation', async () => {
    let header = '';
    server.use(http.post('http://localhost/api/document-flow/documents', ({ request }) => {
      header = request.headers.get('Idempotency-Key') || '';
      return HttpResponse.json({ success: true, data: detailDto() });
    }));
    await documentFlowApi.createDocument({ documentType: 'CONTRACT', direction: 'OUTGOING', title: 'A' }, 'stable-key');
    expect(header).toBe('stable-key');
  });

  it('sends the Java UpdateDocumentRequest payload and verifies the saved number with GET', async () => {
    let patchBody: Record<string, unknown> = {};
    server.use(
      http.patch('http://localhost/api/document-flow/documents/7', async ({ request }) => {
        patchBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: detailDto({ number: 'DOC-2026-001', version: 2 }) });
      }),
      http.get('http://localhost/api/document-flow/documents/7', () =>
        HttpResponse.json({ success: true, data: detailDto({ number: 'DOC-2026-001', version: 2 }) }),
      ),
    );
    await documentFlowApi.updateDocument(7, { documentNumber: 'DOC-2026-001' });
    const actual = await documentFlowApi.document(7);
    expect(patchBody).toEqual({ documentNumber: 'DOC-2026-001' });
    expect(actual.number).toBe('DOC-2026-001');
  });

  it.each<CreationStage>([
    'LOCAL_DRAFT', 'DOCUMENT_CREATED', 'REQUISITES_UPDATED', 'MAIN_FILE_UPLOADED',
    'ATTACHMENTS_UPLOADED', 'PREPARED',
  ])('resumes after a %s-stage failure without duplicate document or route', async (failedAt) => {
    const main = new File(['main'], 'main.pdf', { type: 'application/pdf' });
    const extra = new File(['extra'], 'extra.pdf', { type: 'application/pdf' });
    const document = { id: 7, number: null, version: 1, currentVersionId: null, availableActions: ['SEND'] } as DocumentDetail;
    const route = { id: 9, documentId: 7, status: 'DRAFT' } as SigningRoute;
    const state = {
      created: false, route: null as SigningRoute | null, sent: false,
      attachments: [] as DocumentAttachment[], failed: false,
      calls: { create: 0, update: 0, upload: 0, attachment: 0, route: 0, send: 0 },
    };
    const failAfterEffect = (stage: CreationStage) => {
      if (failedAt === stage && !state.failed) { state.failed = true; throw new Error(`network after ${stage}`); }
    };
    const operations: CreationWorkflowOperations = {
      createDocument: async () => {
        state.calls.create += 1;
        state.created = true;
        failAfterEffect('LOCAL_DRAFT');
        return document;
      },
      updateDocument: async (_id, payload) => {
        state.calls.update += 1;
        document.number = payload.documentNumber ?? null;
        document.version += 1;
        failAfterEffect('DOCUMENT_CREATED');
        return document;
      },
      getDocument: async () => document,
      uploadMainFile: async () => {
        state.calls.upload += 1;
        document.currentVersionId = 3;
        document.version += 1;
        failAfterEffect('REQUISITES_UPDATED');
        return { id: 3, versionNumber: 1 } as DocumentVersion;
      },
      uploadAttachment: async (_id, file) => {
        state.calls.attachment += 1;
        const item = { id: 4, originalFileName: file.name, fileSize: file.size } as DocumentAttachment;
        state.attachments.push(item);
        failAfterEffect('MAIN_FILE_UPLOADED');
        return item;
      },
      listAttachments: async () => state.attachments,
      getSigningRoute: async () => state.route,
      createSigningRoute: async () => {
        state.calls.route += 1;
        state.route = route;
        failAfterEffect('ATTACHMENTS_UPLOADED');
        return route;
      },
      send: async () => {
        state.calls.send += 1;
        state.sent = true;
        state.route = { ...route, status: 'ACTIVE' };
        failAfterEffect('PREPARED');
        return state.route;
      },
    };
    let checkpoint = createCreationCheckpoint(5, 9);
    const run = () => runCreationWorkflow({
      checkpoint,
      createPayload: { documentType: 'CONTRACT', direction: 'OUTGOING', title: 'A' },
      requisites: { documentNumber: 'DOC-1' }, expectedDocumentNumber: 'DOC-1',
      mainFile: main, mainFileRequired: true, attachments: [extra],
      route: { routeType: 'SEQUENTIAL', steps: [{ requiredCount: 1, assignments: [{ signerType: 'EXTERNAL', email: 'a@b.kz', required: true }] }] },
      submit: true, operations,
      persist: (value) => { checkpoint = value; },
    });
    await expect(run()).rejects.toThrow('network after');
    const completed = await run();
    expect(completed.stage).toBe('COMPLETED');
    expect(state.created && state.sent).toBe(true);
    expect(state.calls.route).toBe(1);
    expect(state.calls.upload).toBe(1);
    expect(state.calls.attachment).toBe(1);
  });

  it('never sends private key material in signature payload', async () => {
    let body: Record<string, unknown> = {};
    server.use(http.post('http://localhost/api/document-flow/signatures', async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ data: { id: 1 } });
    }));
    const unsafe = { documentId: 7, versionId: 2, assignmentId: 3, cms: 'cms', clientRequestId: 'request', privateKey: 'secret', password: 'secret', pkcs12: 'secret' };
    await documentFlowApi.submitSignature(unsafe);
    expect(body).toEqual({ documentId: 7, versionId: 2, assignmentId: 3, cms: 'cms', clientRequestId: 'request' });
  });

  it('downloads the signed package as a backend blob', async () => {
    const blob = new Blob(['zip'], { type: 'application/zip' });
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: blob });
    const response = await documentFlowApi.signedPackage(7, 2);
    expect(response.data).toBeInstanceOf(Blob);
    expect(get).toHaveBeenCalledWith('/document-flow/documents/7/signed-package', { params: { organizationId: 2 }, responseType: 'blob' });
  });

  it('accepts nullable membership collections without granting extra access', () => {
    expect(documentFlowOrganizationsSchema.parse([
      { organizationId: 2, organizationName: 'EcoProgress', role: 'OWNER', membershipStatus: 'INVITED', permissions: null },
    ])).toEqual([
      { id: 2, name: 'EcoProgress', role: 'OWNER', membershipStatus: 'INVITED', permissions: undefined },
    ]);
    expect(accessContextSchema.parse({
      available: false,
      readOnly: true,
      status: null,
      features: null,
      permissions: null,
      limits: null,
      usage: null,
      availableActions: null,
      reason: 'Нет активной подписки на модуль документооборота',
    })).toMatchObject({ available: false, features: [], permissions: [], limits: {}, usage: {}, availableActions: [] });
  });

  it('maps the deployed organization membership DTO', () => {
    expect(documentFlowOrganizationsSchema.parse([{
      organizationId: 2,
      name: 'Администратор ECOPROGRESS GROUP',
      bin: 'DF-USER-1',
      role: 'OWNER',
      status: 'INVITED',
      readOnly: false,
    }])).toEqual([{
      id: 2,
      name: 'Администратор ECOPROGRESS GROUP',
      bin: 'DF-USER-1',
      role: 'OWNER',
      membershipStatus: 'INVITED',
      readOnly: false,
      permissions: undefined,
    }]);
  });

  it('activates an invited membership through the confirmed member endpoint', async () => {
    let called = '';
    server.use(http.post('http://localhost/api/document-flow/members/41/activate', ({ request }) => {
      called = request.url;
      return HttpResponse.json({ data: { id: 41, organizationId: 2, userId: 1, fullName: 'Администратор', email: 'admin@ecoprogress.kz', role: 'OWNER', status: 'ACTIVE' } });
    }));
    await expect(documentFlowApi.activateMember(41, 2)).resolves.toMatchObject({ id: 41, status: 'ACTIVE' });
    expect(new URL(called).searchParams.get('organizationId')).toBe('2');
  });

  it('offers self-activation only for the invited administrator flow', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/document-flow/components/DocumentFlowGate.tsx'), 'utf8');
    expect(source).toContain("membershipStatus?.toUpperCase() === 'INVITED'");
    expect(source).toContain('Активировать моё участие');
    expect(source).toContain('canManageAccess');
  });

  it('provides a staff entry page with an explicit sign-in button', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const layout = readFileSync(resolve(process.cwd(), 'src/layouts/StaffLayout.tsx'), 'utf8');
    const entry = readFileSync(resolve(process.cwd(), 'src/features/document-flow/pages/DocumentFlowEntryPage.tsx'), 'utf8');
    expect(app).toContain('path="/staff/document-flow"');
    expect(layout).toContain("label: 'Документооборот', path: '/staff/document-flow'");
    expect(entry).toContain('Войти под аккаунтом организации');
    expect(entry).toContain('to="/document-flow/login?redirect=%2Fdocument-flow"');
    expect(entry).toContain('onClick={logout}');
  });

  it('provides the public request and sign-in path without inventing access-request DTO fields', () => {
    const routes = readFileSync(resolve(process.cwd(), 'src/features/document-flow/DocumentFlowRoutes.tsx'), 'utf8');
    const landing = readFileSync(resolve(process.cwd(), 'src/features/document-flow/pages/DocumentFlowLandingPage.tsx'), 'utf8');
    const login = readFileSync(resolve(process.cwd(), 'src/pages/LoginPage.tsx'), 'utf8');
    expect(routes).toContain('<Route index element={<DocumentFlowLandingPage />} />');
    expect(routes).toContain('<Route path="login" element={<DocumentFlowLoginPage documentFlow />} />');
    expect(login).toContain('Войти как участник организации');
    expect(login).toContain('Войти как сотрудник EcoProgress');
    expect(login).toContain('await staffLogin(email, password)');
    expect(landing).toContain('Оставить заявку');
    expect(landing).toContain('Войти');
    expect(login).toContain('safeRedirect');

    const payload = toAccessRequestPayload({
      organizationName: 'ТОО Эко Тест', bin: '123456789012', contactName: 'Иван Иванов',
      phone: '+77010000000', email: 'owner@example.kz', planCode: 'START', membersCount: 3, comment: 'Позвонить утром',
    });
    expect(payload).toEqual({
      contactName: 'Иван Иванов', phone: '+77010000000', email: 'owner@example.kz', planCode: 'START', membersCount: 3,
      comment: 'Организация: ТОО Эко Тест\nБИН/ИИН: 123456789012\nПозвонить утром',
    });
    expect(payload).not.toHaveProperty('organizationName');
    expect(payload).not.toHaveProperty('bin');
  });

  it('normalizes organizations and never uses userId as tenant', async () => {
    server.use(http.get('http://localhost/api/document-flow/organizations', () => HttpResponse.json({ data: [
      { organizationId: 12, organizationName: 'Eco One', role: 'OWNER', membershipStatus: 'ACTIVE' },
    ] })));
    await expect(documentFlowApi.organizations()).resolves.toEqual([
      { id: 12, name: 'Eco One', role: 'OWNER', membershipStatus: 'ACTIVE', permissions: undefined },
    ]);
  });

  it('uses server member filters and selected organization scope', async () => {
    let seen = '';
    server.use(http.get('http://localhost/api/document-flow/members', ({ request }) => {
      seen = request.url;
      return HttpResponse.json({ data: {
        items: [{ id: 4, organizationId: 12, userId: 8, fullName: 'Иван И.', email: 'i@example.kz', role: 'SIGNER', status: 'ACTIVE' }],
        page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true, hasNext: false, hasPrevious: false,
      } });
    }));
    const result = await documentFlowApi.members({ organizationId: 12, query: 'Иван', status: 'ACTIVE', role: 'SIGNER', page: 0, size: 20, sort: 'fullName,asc' });
    expect(result.items[0]).toMatchObject({ id: 4, organizationId: 12, role: 'SIGNER' });
    const params = new URL(seen).searchParams;
    expect(params.get('organizationId')).toBe('12');
    expect(params.get('query')).toBe('Иван');
  });

  it('public signing challenge and submit are token-only contracts', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.get('http://localhost/api/public/document-flow/signing/token/challenge', () => HttpResponse.json({ data: { opaque: true } })),
      http.post('http://localhost/api/public/document-flow/signing/token/sign', async ({ request }) => {
        bodies.push(await request.json() as Record<string, unknown>);
        return HttpResponse.json({ data: { id: 1 } });
      }),
    );
    await expect(publicDocumentFlowApi.challenge('token')).resolves.toEqual({ opaque: true });
    await publicDocumentFlowApi.sign('token', { cms: 'cms', clientRequestId: 'request-1' });
    expect(bodies).toEqual([{ cms: 'cms', clientRequestId: 'request-1' }]);
  });

  it('hides MIXED without feature and exposes unknown status as incompatible', () => {
    render(<SigningRouteBuilder access={access()} value={{ routeType: 'SEQUENTIAL', steps: [] }} onChange={() => undefined} />);
    expect(screen.queryByText('MIXED')).toBeNull();
    cleanup();
    render(<DocumentStatusBadge status="BACKEND_NEW_STATUS" />);
    expect(screen.getByText(/Неизвестный статус/)).toBeTruthy();
  });
});
