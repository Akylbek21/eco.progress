import type { PekReport } from '../api/pekContracts';

// Older servers expose document generation but omit the first-package action.
// An explicit package denial always takes precedence over this compatibility path.
export const canGeneratePekPackage = (report: PekReport, packageAction?: boolean) => {
  if (report.status === 'SIGNED' || report.status === 'ARCHIVED') return false;
  return packageAction ?? report.availableActions.generatePackage
    ?? (report.availableActions.generateDocument === true);
};
