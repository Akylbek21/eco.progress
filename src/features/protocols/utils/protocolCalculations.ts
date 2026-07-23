import type { ComparisonType, ComplianceStatus } from '../../../types/protocols';

export interface ComplianceInput {
  result: number | null | undefined;
  comparisonType?: ComparisonType;
  normativeValue?: number | null;
  normativeMin?: number | null;
  normativeMax?: number | null;
  resultUnit?: string | null;
  normativeUnit?: string | null;
}

export const calculateCompliance = (input: ComplianceInput): ComplianceStatus => {
  if (input.result === null || input.result === undefined || !Number.isFinite(input.result)) return 'EMPTY_RESULT';
  if (input.resultUnit && input.normativeUnit && input.resultUnit.trim() !== input.normativeUnit.trim()) return 'UNIT_MISMATCH';
  const comparison = input.comparisonType;
  if (!comparison) return 'NORMATIVE_NOT_FOUND';
  if (comparison === 'INFO') return 'INFO';
  if (comparison === 'LESS_OR_EQUAL' && input.normativeMax != null) return input.result <= input.normativeMax ? 'NORMAL' : 'EXCEEDED';
  if (comparison === 'GREATER_OR_EQUAL' && input.normativeMin != null) return input.result >= input.normativeMin ? 'NORMAL' : 'BELOW_REQUIRED';
  if (comparison === 'RANGE' && input.normativeMin != null && input.normativeMax != null) {
    return input.result >= input.normativeMin && input.result <= input.normativeMax ? 'NORMAL' : input.result < input.normativeMin ? 'BELOW_REQUIRED' : 'EXCEEDED';
  }
  if (comparison === 'EQUAL' && input.normativeValue != null) return input.result === input.normativeValue ? 'NORMAL' : 'EXCEEDED';
  return 'NEEDS_REVIEW';
};
