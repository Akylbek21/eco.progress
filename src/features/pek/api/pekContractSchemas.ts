import { z } from 'zod';

const positiveId = z.coerce.number().int().positive();
const version = z.coerce.number().int().nonnegative();

export const pekProgramContractSchema = z.object({
  id: positiveId,
  version,
  number: z.string(),
  name: z.string(),
  status: z.string().min(1),
  validFrom: z.string().min(1),
  validUntil: z.string().min(1),
}).passthrough();

export const pekReportContractSchema = z.object({
  id: positiveId,
  version,
  status: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
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
