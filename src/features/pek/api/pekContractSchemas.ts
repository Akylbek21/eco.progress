import { z } from 'zod';

const positiveId = z.coerce.number().int().positive();
const version = z.coerce.number().int().nonnegative();
const pekSubmissionRecordSchema = z.object({
  submissionMethod: z.enum(['ECO_PORTAL', 'EGOV_PORTAL', 'EMAIL', 'PAPER', 'COURIER', 'OTHER']).nullable(),
  registrationNumber: z.string().nullable().optional(),
  submissionComment: z.string().nullable().optional(),
  confirmationFileId: z.string().nullable().optional(),
  submittedAt: z.string().nullable().optional(),
  submittedBy: z.unknown().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
}).passthrough();

export const pekProgramContractSchema = z.object({
  id: positiveId,
  version,
  contentRevision: version.optional(),
  regulationVersion: z.string().nullable().optional(),
  templateVersion: z.string().nullable().optional(),
  number: z.string(),
  name: z.string(),
  status: z.string().min(1),
  validFrom: z.string().min(1),
  validUntil: z.string().min(1),
}).passthrough();

export const pekReportContractSchema = z.object({
  id: positiveId,
  companyId: positiveId,
  objectId: positiveId,
  programId: positiveId,
  version,
  contentRevision: version.optional(),
  regulationVersion: z.string().nullable().optional(),
  templateVersion: z.string().nullable().optional(),
  status: z.string().min(1),
  periodType: z.enum(['QUARTER', 'YEAR']),
  reportType: z.enum(['PEK_QUARTERLY', 'PEK_TABLES_7_12_ANNUAL', 'PEM_CASPIAN_ANNUAL']).nullable().optional(),
  reportYear: z.coerce.number().int(),
  reportQuarter: z.coerce.number().int().min(1).max(4).nullable(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  submissionDueDate: z.string().nullable().optional(),
  submittedAt: z.string().nullable().optional(),
  submission: pekSubmissionRecordSchema.nullable().optional(),
  acceptedAt: z.string().nullable().optional(),
  rejectedAt: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  linkedProtocolCount: z.coerce.number().int().nonnegative(),
}).passthrough();

export class PekContractError extends Error {
  readonly code = 'PEK_CONTRACT_ERROR';
  constructor(entity: string, issues: z.ZodIssue[]) {
    super(`Backend вернул некорректный контракт ${entity}: ${issues.map((issue) => issue.path.join('.') || issue.message).join(', ')}`);
    this.name = 'PekContractError';
  }
}

export const validatePekContract = <T>(schema: z.ZodType<T>, value: unknown, entity: string): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new PekContractError(entity, parsed.error.issues);
  return parsed.data;
};
