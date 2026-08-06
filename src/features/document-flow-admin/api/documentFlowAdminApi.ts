import api from '../../../services/api';
import { unwrapApiResponse, type ApiResponse } from '../../../services/apiHelpers';
import { accessContextSchema } from '../../document-flow/api/contractSchemas';
import type { AccessContext, UsageMetric } from '../../document-flow/model/types';
import { getCompanies } from '../../../services/companyService';
import type {
  AccessGrantRequest, DocumentFlowAdminPlan, DocumentFlowAdminSubscription, OrganizationSearchParams,
} from '../model/types';
import { accessGrantRequestSchema, accessGrantResponseSchema, plansResponseSchema, subscriptionResponseSchema, subscriptionsResponseSchema } from './documentFlowAdminSchemas';

const unwrap = <T>(response: { data: ApiResponse<T> | T }): T => unwrapApiResponse<T>(response.data);
const parse = <T>(schema: { parse(value: unknown): unknown }, value: unknown): T => schema.parse(value) as T;

export const documentFlowAdminApi = {
  searchOrganizations: ({ query, page, size, sort, signal }: OrganizationSearchParams) => getCompanies({
    page, size, search: query?.trim() || undefined, status: 'ACTIVE', sort,
  }, signal),
  plans: async (signal?: AbortSignal) => parse<DocumentFlowAdminPlan[]>(plansResponseSchema,
    unwrap<unknown>(await api.get('/admin/document-flow/plans', { signal }))),
  subscriptions: async (signal?: AbortSignal) => parse<DocumentFlowAdminSubscription[]>(subscriptionsResponseSchema,
    unwrap<unknown>(await api.get('/admin/document-flow/subscriptions', { signal }))),
  subscription: async (organizationId: number, signal?: AbortSignal) => parse<DocumentFlowAdminSubscription>(subscriptionResponseSchema,
    unwrap<unknown>(await api.get(`/admin/document-flow/subscriptions/${organizationId}`, { signal }))),
  organizationAccess: async (organizationId: number, signal?: AbortSignal) => parse<AccessContext>(accessContextSchema,
    unwrap<unknown>(await api.get('/document-flow/access', { params: { organizationId }, signal }))),
  createAccessGrant: async (request: AccessGrantRequest, idempotencyKey: string) => {
    const payload = accessGrantRequestSchema.parse(request);
    const raw = unwrap<unknown>(await api.post('/admin/document-flow/access-grants', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }));
    return accessGrantResponseSchema.parse(raw);
  },
  extend: (organizationId: number, expiresAt: string, reason: string) =>
    api.post(`/admin/document-flow/subscriptions/${organizationId}/extend`, { expiresAt, reason }),
  changePlan: (organizationId: number, planCode: string, reason: string) =>
    api.post(`/admin/document-flow/subscriptions/${organizationId}/change-plan`, { planCode, reason }),
  changeLimits: (organizationId: number, limits: Partial<Record<UsageMetric, number>>, reason: string) =>
    api.post(`/admin/document-flow/subscriptions/${organizationId}/limits`, { limits, reason }),
  suspend: (organizationId: number, reason: string) =>
    api.post(`/admin/document-flow/subscriptions/${organizationId}/suspend`, { reason }),
  restore: (organizationId: number, reason: string) =>
    api.post(`/admin/document-flow/subscriptions/${organizationId}/restore`, { reason }),
  revoke: (organizationId: number, reason: string) =>
    api.post(`/admin/document-flow/subscriptions/${organizationId}/revoke`, { reason }),
};

