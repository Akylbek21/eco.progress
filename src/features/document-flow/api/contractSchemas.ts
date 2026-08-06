import { z } from 'zod';

const nullableString = z.string().nullable();
const userSummary = z.object({ id: z.number(), fullName: z.string() }).passthrough();
const counterpartySummary = z.object({ id: z.number(), name: z.string(), bin: z.string() }).passthrough();
const permissions = z.object({
  canView: z.boolean(), canEdit: z.boolean(), canDelete: z.boolean(), canSend: z.boolean(),
  canDownload: z.boolean(), canUploadVersion: z.boolean(), canArchive: z.boolean(), canManageAttachments: z.boolean(),
}).passthrough();

const numericRecord = z.record(z.string(), z.unknown()).transform((record) => Object.fromEntries(
  Object.entries(record).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])),
));

const documentBase = {
  id: z.number(), number: nullableString, title: z.string(), type: z.string(), direction: z.string(),
  counterparty: counterpartySummary.nullable(), author: userSummary.nullable(), createdAt: z.string(), updatedAt: z.string(),
  deadline: nullableString, status: z.string(), version: z.number(), permissions,
  availableActions: z.array(z.string()),
};

/** Java: DocumentDtos.DocumentListItemDto. */
export const documentListItemSchema = z.object({
  ...documentBase,
  signedCount: z.number().int(), requiredCount: z.number().int(), rejectedCount: z.number().int(),
  requiresMySignature: z.boolean(), currentStep: z.number().int().nullable().optional(),
}).passthrough();

/** Java: DocumentDtos.DocumentDetailDto (not a subtype of DocumentListItemDto). */
export const documentDetailSchema = z.object({
  ...documentBase,
  publicId: z.string(), description: nullableString, currentVersionId: z.number().nullable(),
}).passthrough();

export const pageSchema = <T extends z.ZodType>(item: T) => z.object({
  items: z.array(item), page: z.number().int(), size: z.number().int(), totalElements: z.number().int(),
  totalPages: z.number().int(), first: z.boolean(), last: z.boolean(), hasNext: z.boolean(), hasPrevious: z.boolean(),
}).passthrough();

const organizationSummarySchema = z.object({
  id: z.number().int(), name: z.string(), role: nullableString.optional(),
  membershipStatus: nullableString.optional(), permissions: z.array(z.string()).nullish(),
}).passthrough().transform((value) => ({
  ...value,
  permissions: value.permissions ?? undefined,
}));

const organizationMembershipSchema = z.object({
  organizationId: z.number().int(), organizationName: z.string(), role: nullableString.optional(),
  membershipStatus: nullableString.optional(), permissions: z.array(z.string()).nullish(),
}).passthrough().transform((value) => ({
  id: value.organizationId,
  name: value.organizationName,
  role: value.role,
  membershipStatus: value.membershipStatus,
  permissions: value.permissions ?? undefined,
}));

export const documentFlowOrganizationSchema = z.union([organizationSummarySchema, organizationMembershipSchema]);
export const documentFlowOrganizationsSchema = z.array(documentFlowOrganizationSchema);

/** Java: AccessContextDto. */
export const accessContextSchema = z.object({
  available: z.boolean(), readOnly: z.boolean(), status: nullableString.optional().default(null),
  internalMode: z.boolean().optional(), organizationId: z.union([z.number().int(), z.string()]).nullable().optional(),
  role: nullableString.optional(), membershipStatus: nullableString.optional(),
  organization: organizationSummarySchema.nullable().optional(),
  plan: z.unknown().optional().default(null),
  startsAt: nullableString.optional().default(null), expiresAt: nullableString.optional().default(null),
  daysRemaining: z.number().int().nullable().optional().default(null),
  features: z.array(z.string()).nullish().transform((value) => value ?? []),
  permissions: z.array(z.string()).nullish().transform((value) => value ?? []),
  limits: numericRecord.nullish().transform((value) => value ?? {}), usage: numericRecord.nullish().transform((value) => value ?? {}),
  availableActions: z.array(z.string()).nullish().transform((value) => value ?? []), reason: nullableString.optional().default(null), testMode: z.boolean().optional(),
}).passthrough();

/** Java: SigningRouteDtos.AssignmentResponse. */
export const signingAssignmentSchema = z.object({
  id: z.number(), stepId: z.number(), signerType: z.string(), memberId: z.number().nullable(),
  signerFullName: nullableString, organizationName: nullableString, organizationBin: nullableString,
  email: nullableString, phone: nullableString, roleCode: nullableString, required: z.boolean(), status: z.string(),
  availableAt: nullableString, viewedAt: nullableString, signedAt: nullableString, rejectedAt: nullableString,
  rejectionReason: nullableString, invitationExpiresAt: nullableString,
}).passthrough();

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
}).passthrough();

/** Java: ApiResponse error projection. */
export const apiErrorSchema = z.object({
  data: z.unknown().nullable().optional(), message: nullableString.optional(), success: z.literal(false),
  errors: z.array(z.unknown()).nullable().optional(), code: nullableString.optional(),
  fieldErrors: z.record(z.string(), z.string()).nullable().optional(), traceId: nullableString.optional(),
}).strict();
