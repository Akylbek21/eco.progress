import { isWaterProtocolType } from '../../../config/protocolWater';
import type { Protocol, UpdateProtocolPayload } from '../../../types/protocols';

/**
 * Builds the complete PATCH payload expected by the protocol backend.
 * Keeping this in one place prevents quick PEK entry and the editor from
 * accidentally clearing different parts of the same draft.
 */
export const protocolToUpdatePayload = (item: Protocol): UpdateProtocolPayload => ({
  templateId: item.templateId,
  version: Number(item.version || 0),
  number: item.protocolNumber || item.number || '',
  protocolDate: item.protocolDate || '',
  companyId: item.companyId,
  objectId: item.objectId,
  laboratoryId: item.laboratory?.laboratoryId || item.laboratory?.id,
  sampleDate: item.testing.samplingDate || item.measurementDate || item.protocolDate,
  sampleNumber: item.sampleNumber,
  samplingPlace: item.samplingPlace || item.measurementPlace,
  samplingDepth: item.samplingDepth,
  sourceNumber: item.sourceNumber,
  measurementDate: item.measurementDate || item.testing.samplingDate || item.protocolDate,
  measurementTime: item.measurementTime,
  measurementPlace: item.measurementPlace,
  basis: item.testingBasis,
  formCode: item.formCode,
  appendixNumber: item.appendixNumber,
  executor: item.executor || '',
  executorId: item.executorId == null ? undefined : String(item.executorId),
  approver: item.approver || '',
  laboratory: item.laboratory,
  organization: item.organization,
  testing: item.testing,
  environment: item.environment,
  conditions: {
    ...(item.conditions || {}),
    ...(isWaterProtocolType(item.templateId) ? {
      waterType: item.waterType,
      waterUseCategory: item.waterUseCategory,
    } : {}),
  },
  explanatoryNote: item.explanatoryNote,
  testingMethodDocument: item.testingMethodDocument || item.testing.testingMethodDocument,
  complianceDocument: item.complianceDocument,
  printVisibility: item.printVisibility,
  samplingPoints: item.samplingPoints,
});
