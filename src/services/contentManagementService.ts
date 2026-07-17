import api from './api';
import { unwrapApiResponse } from './apiHelpers';
import type {
  CmsComment, CmsContentDetail, CmsContentSummary, CmsContentType, CmsContentVersion, CmsDashboard,
  CmsFile, CmsListFilters, CmsPage, CmsPreviewToken, CmsStatusHistory, CmsValidationResult, CmsVersionDiff, CmsWorkflowAction, CreateCmsContentInput,
  ContentAnalyticsSummary,
} from '../types/contentManagement';

type ApiEnvelope<T> = { data: T; message: string | null };

const resourceByType: Record<CmsContentType, string> = {
  SERVICE: 'services', ARTICLE: 'articles', REGION: 'regions', REGIONAL_PAGE: 'regional-pages', CASE: 'cases',
  EXPERT: 'experts', TRUST_DOCUMENT: 'trust-documents', LEGAL_SOURCE: 'legal-sources',
  REDIRECT: 'redirects',
};

export const contentResource = (type: CmsContentType) => resourceByType[type];

export const getContentDashboard = async (): Promise<CmsDashboard> => {
  const { data } = await api.get<ApiEnvelope<CmsDashboard>>('/admin/content/dashboard');
  return unwrapApiResponse(data);
};

export const getContentItems = async (filters: CmsListFilters = {}): Promise<CmsPage<CmsContentSummary>> => {
  const resource = filters.type ? resourceByType[filters.type] : 'items';
  const { type: _type, ...params } = filters;
  const { data } = await api.get<ApiEnvelope<CmsPage<CmsContentSummary>>>(`/admin/content/${resource}`, { params });
  return unwrapApiResponse(data);
};

export const getContentItem = async (type: CmsContentType, id: string): Promise<CmsContentDetail> => {
  const { data } = await api.get<ApiEnvelope<CmsContentDetail>>(`/admin/content/${resourceByType[type]}/${encodeURIComponent(id)}`);
  return unwrapApiResponse(data);
};

export const createContentItem = async (type: CmsContentType, payload: CreateCmsContentInput): Promise<CmsContentDetail> => {
  const { data } = await api.post<ApiEnvelope<CmsContentDetail>>(`/admin/content/${resourceByType[type]}`, payload);
  return unwrapApiResponse(data);
};

export const updateContentItem = async (item: CmsContentDetail, changeSummary: string): Promise<CmsContentDetail> => {
  const { data } = await api.put<ApiEnvelope<CmsContentDetail>>(`/admin/content/${resourceByType[item.type]}/${encodeURIComponent(item.id)}`, {
    slug: item.slug, title: item.title, category: item.category, isActive: item.isActive, indexAllowed: item.indexAllowed,
    locale: item.locale, schemaVersion: item.schemaVersion, payload: item.payload, seo: item.seo,
    optimisticLockVersion: item.optimisticLockVersion, changeSummary,
  });
  return unwrapApiResponse(data);
};

export const runContentWorkflowAction = async (type: CmsContentType, id: string, action: CmsWorkflowAction, body: { comment: string; scheduledAt?: string }): Promise<CmsContentDetail> => {
  const { data } = await api.post<ApiEnvelope<CmsContentDetail>>(`/admin/content/${resourceByType[type]}/${encodeURIComponent(id)}/${action}`, body);
  return unwrapApiResponse(data);
};

export const validateContentItem = async (type: CmsContentType, id: string, audit: 'validate' | 'seo-audit' | 'content-audit' = 'validate'): Promise<CmsValidationResult> => {
  const { data } = await api.post<ApiEnvelope<CmsValidationResult>>(`/admin/content/${resourceByType[type]}/${encodeURIComponent(id)}/${audit}`);
  return unwrapApiResponse(data);
};

export const getContentVersions = async (type: CmsContentType, id: string): Promise<CmsContentVersion[]> => {
  const { data } = await api.get<ApiEnvelope<CmsContentVersion[]>>(`/admin/content/${resourceByType[type]}/${encodeURIComponent(id)}/versions`);
  return unwrapApiResponse(data);
};

export const compareContentVersions = async (type: CmsContentType, id: string, left: string, right: string): Promise<CmsVersionDiff> => {
  const { data } = await api.get<ApiEnvelope<CmsVersionDiff>>(`/admin/content/${resourceByType[type]}/${encodeURIComponent(id)}/versions/compare`, { params: { left, right } });
  return unwrapApiResponse(data);
};

export const restoreContentVersion = async (type: CmsContentType, id: string, versionId: string, comment: string): Promise<CmsContentDetail> => {
  const { data } = await api.post<ApiEnvelope<CmsContentDetail>>(`/admin/content/${resourceByType[type]}/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/restore`, { comment });
  return unwrapApiResponse(data);
};

export const getContentHistory = async (type: CmsContentType, id: string): Promise<CmsStatusHistory[]> => {
  const { data } = await api.get<ApiEnvelope<CmsStatusHistory[]>>(`/admin/content/${resourceByType[type]}/${encodeURIComponent(id)}/history`);
  return unwrapApiResponse(data);
};

export const getContentComments = async (type: CmsContentType, id: string): Promise<CmsComment[]> => {
  const { data } = await api.get<ApiEnvelope<CmsComment[]>>(`/admin/content/${resourceByType[type]}/${encodeURIComponent(id)}/comments`);
  return unwrapApiResponse(data);
};

export const addContentComment = async (type: CmsContentType, id: string, payload: Pick<CmsComment, 'versionId' | 'fieldPath' | 'text' | 'blocking'>): Promise<CmsComment> => {
  const { data } = await api.post<ApiEnvelope<CmsComment>>(`/admin/content/${resourceByType[type]}/${encodeURIComponent(id)}/comments`, payload);
  return unwrapApiResponse(data);
};

export const resolveContentComment = async (commentId: string): Promise<CmsComment> => {
  const { data } = await api.post<ApiEnvelope<CmsComment>>(`/admin/content/comments/${encodeURIComponent(commentId)}/resolve`);
  return unwrapApiResponse(data);
};

export const uploadContentFile = async (type: CmsContentType, id: string, file: File, metadata: { altText?: string; publicAccess: boolean }): Promise<CmsFile> => {
  const form = new FormData();
  form.append('file', file);
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  const { data } = await api.post<ApiEnvelope<CmsFile>>(`/admin/content/${resourceByType[type]}/${encodeURIComponent(id)}/files`, form);
  return unwrapApiResponse(data);
};

export const createContentPreviewToken = async (type: CmsContentType, id: string): Promise<CmsPreviewToken> => {
  const { data } = await api.post<ApiEnvelope<CmsPreviewToken>>(`/admin/content/${resourceByType[type]}/${encodeURIComponent(id)}/preview-token`);
  return unwrapApiResponse(data);
};

export const getContentAnalytics = async (params: { from?: string; to?: string; type?: CmsContentType; regionId?: string }): Promise<ContentAnalyticsSummary> => {
  const { data } = await api.get<ApiEnvelope<ContentAnalyticsSummary>>('/admin/content/analytics', { params });
  return unwrapApiResponse(data);
};
