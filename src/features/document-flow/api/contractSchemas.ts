import { z } from 'zod';

const nullableString = z.string().nullable();
const userSummary = z.object({ id: z.number(), fullName: z.string() }).strict();
const counterpartySummary = z.object({ id: z.number(), name: z.string(), bin: z.string() }).strict();
const permissions = z.object({
  canView: z.boolean(), canEdit: z.boolean(), canDelete: z.boolean(), canSend: z.boolean(),
  canDownload: z.boolean(), canUploadVersion: z.boolean(), canArchive: z.boolean(), canManageAttachments: z.boolean(),
}).strict();

const documentBase = {
  id: z.number(), number: nullableString, title: z.string(), type: z.string(), direction: z.string(),
  counterparty: counterpartySummary.nullable(), author: userSummary.nullable(), createdAt: z.string(),
  deadline: nullableString, status: z.string(), version: z.number(), permissions,
  availableActions: z.array(z.string()),
};

/** Java: DocumentDtos.DocumentListItemDto. */
export const documentListItemSchema = z.object({
  ...documentBase,
  signedCount: z.number().int(), requiredCount: z.number().int(), requiresMySignature: z.boolean(),
}).strict();

/** Java: DocumentDtos.DocumentDetailDto (not a subtype of DocumentListItemDto). */
export const documentDetailSchema = z.object({
  ...documentBase,
  publicId: z.string(), description: nullableString, updatedAt: z.string(), currentVersionId: z.number().nullable(),
}).strict();

export const pageSchema = <T extends z.ZodType>(item: T) => z.object({
  items: z.array(item), page: z.number().int(), size: z.number().int(), totalElements: z.number().int(),
  totalPages: z.number().int(), first: z.boolean(), last: z.boolean(), hasNext: z.boolean(), hasPrevious: z.boolean(),
}).strict();

/** Java: AccessContextDto. */
export const accessContextSchema = z.object({
  available: z.boolean(), readOnly: z.boolean(), status: nullableString,
  plan: z.object({ code: z.string(), name: z.string() }).strict().nullable(),
  startsAt: nullableString, expiresAt: nullableString, daysRemaining: z.number().int().nullable(),
  features: z.array(z.string()), permissions: z.array(z.string()),
  limits: z.record(z.string(), z.number()), usage: z.record(z.string(), z.number()),
  availableActions: z.array(z.string()), reason: nullableString,
}).strict();

/** Java: SigningRouteDtos.AssignmentResponse. */
export const signingAssignmentSchema = z.object({
  id: z.number(), stepId: z.number(), signerType: z.string(), userId: z.number().nullable(),
  signerFullName: nullableString, organizationName: nullableString, organizationBin: nullableString,
  email: nullableString, phone: nullableString, roleCode: nullableString, required: z.boolean(), status: z.string(),
  availableAt: nullableString, viewedAt: nullableString, signedAt: nullableString, rejectedAt: nullableString,
  rejectionReason: nullableString, invitationExpiresAt: nullableString,
}).strict();

/** Java: SigningRouteDtos.SigningRouteResponse. */
export const signingRouteSchema = z.object({
  id: z.number(), documentId: z.number(), routeType: z.string(), status: z.string(), createdBy: z.number(),
  createdAt: z.string(), activatedAt: nullableString, completedAt: nullableString, version: z.number(),
  steps: z.array(z.object({
    id: z.number(), stepOrder: z.number().int(), requiredCount: z.number().int(), assignments: z.array(signingAssignmentSchema),
  }).strict()),
}).strict();

/** Java: PublicSigningService.PublicInvitationView. */
export const publicInvitationSchema = z.object({
  documentId: z.number(), documentTitle: z.string(), roleCode: nullableString, required: z.boolean(),
  status: z.string(), invitationExpiresAt: nullableString, signingDeadline: nullableString,
}).strict();

/** Java: ApiResponse error projection. */
export const apiErrorSchema = z.object({
  data: z.unknown().nullable().optional(), message: nullableString.optional(), success: z.literal(false),
  errors: z.array(z.unknown()).nullable().optional(), code: nullableString.optional(),
  fieldErrors: z.record(z.string(), z.string()).nullable().optional(), traceId: nullableString.optional(),
}).strict();
