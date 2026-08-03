export type BackendProtocolPermissions = {
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canCalculate?: boolean;
  canCheckNormatives?: boolean;
  canGeneratePreview?: boolean;
  canSendToApproval?: boolean;
  canReturnForRevision?: boolean;
  canApprove?: boolean;
  canSign?: boolean;
  canCreateCorrection?: boolean;
  canCancel?: boolean;
  canArchive?: boolean;
  canPublish?: boolean;
  canPrepareSigning?: boolean;
  canDownloadPdf?: boolean;
  canDownloadDocx?: boolean;
};

const allowed = (value: unknown) => value === true;

/** The only boundary that maps backend permission names to UI capabilities. */
export const mapProtocolPermissions = (input: unknown): Record<string, boolean> => {
  const source = input && typeof input === 'object'
    ? input as BackendProtocolPermissions
    : {};
  const canView = allowed(source.canView);
  const canEdit = allowed(source.canEdit);
  const canGeneratePreview = allowed(source.canGeneratePreview);

  return {
    canView,
    canEdit,
    canDelete: allowed(source.canDelete),
    canCalculate: allowed(source.canCalculate),
    canCheckNormatives: allowed(source.canCheckNormatives),
    canGeneratePreview,
    canSendToApproval: allowed(source.canSendToApproval),
    canReturnForRevision: allowed(source.canReturnForRevision),
    canApprove: allowed(source.canApprove),
    canSign: allowed(source.canSign),
    canCreateCorrection: allowed(source.canCreateCorrection),
    canCancel: allowed(source.canCancel),
    canArchive: allowed(source.canArchive),
    canPublish: allowed(source.canPublish),
    canPrepareSigning: allowed(source.canPrepareSigning),
    canDownloadPdf: allowed(source.canDownloadPdf),
    canDownloadDocx: allowed(source.canDownloadDocx),
    canReadyForApproval: allowed(source.canSendToApproval),
    canReplace: allowed(source.canCreateCorrection),
    canGenerateDocuments: canGeneratePreview,
    canDownload: canView,
    canManageResults: canEdit,
    canManageDevices: canEdit,
    canViewAudit: canView,
  };
};
