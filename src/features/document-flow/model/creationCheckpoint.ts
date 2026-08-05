import type {
  CreateDocumentRequest, DocumentAttachment, DocumentDetail, DocumentVersion, SigningRoute, SigningRouteRequest,
  UpdateDocumentRequest,
} from './types';

export type CreationStage =
  | 'LOCAL_DRAFT'
  | 'DOCUMENT_CREATED'
  | 'REQUISITES_UPDATED'
  | 'MAIN_FILE_UPLOADED'
  | 'ATTACHMENTS_UPLOADED'
  | 'ROUTE_CREATED'
  | 'PREPARED'
  | 'SENT'
  | 'COMPLETED';

export interface CreationCheckpoint {
  schemaVersion: number;
  userId: number;
  organizationScope: string;
  documentId?: number;
  routeId?: number;
  backendVersion?: number;
  stage: CreationStage;
  uploadedAttachmentIds: number[];
  idempotencyKey: string;
  updatedAt: string;
}

export const CREATION_CHECKPOINT_SCHEMA_VERSION = 1;

const stages: CreationStage[] = [
  'LOCAL_DRAFT', 'DOCUMENT_CREATED', 'REQUISITES_UPDATED', 'MAIN_FILE_UPLOADED',
  'ATTACHMENTS_UPLOADED', 'ROUTE_CREATED', 'PREPARED', 'SENT', 'COMPLETED',
];

const reached = (current: CreationStage, expected: CreationStage) => stages.indexOf(current) >= stages.indexOf(expected);

export const createCreationCheckpoint = (userId: number, organizationScope: string): CreationCheckpoint => ({
  schemaVersion: CREATION_CHECKPOINT_SCHEMA_VERSION,
  userId,
  organizationScope,
  stage: 'LOCAL_DRAFT',
  uploadedAttachmentIds: [],
  idempotencyKey: crypto.randomUUID(),
  updatedAt: new Date().toISOString(),
});

export const creationCheckpointStorageKey = (userId: number, organizationScope: string) =>
  `document-flow:create-checkpoint:${userId}:${organizationScope}`;

export const readCreationCheckpoint = (key: string, userId: number, organizationScope: string): CreationCheckpoint | null => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as CreationCheckpoint;
    if (value.schemaVersion !== CREATION_CHECKPOINT_SCHEMA_VERSION || value.userId !== userId
      || value.organizationScope !== organizationScope || !stages.includes(value.stage)
      || !value.idempotencyKey || !Array.isArray(value.uploadedAttachmentIds)) throw new Error('invalid checkpoint');
    return value;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

export interface CreationWorkflowOperations {
  createDocument(payload: CreateDocumentRequest, idempotencyKey: string): Promise<DocumentDetail>;
  updateDocument(id: number, payload: UpdateDocumentRequest): Promise<DocumentDetail>;
  getDocument(id: number): Promise<DocumentDetail>;
  uploadMainFile(id: number, file: File): Promise<DocumentVersion>;
  uploadAttachment(id: number, file: File): Promise<DocumentAttachment>;
  listAttachments(id: number): Promise<DocumentAttachment[]>;
  getSigningRoute(id: number): Promise<SigningRoute | null>;
  createSigningRoute(id: number, payload: SigningRouteRequest): Promise<SigningRoute>;
  prepare(id: number, expectedVersion: number): Promise<SigningRoute>;
  send(id: number): Promise<SigningRoute>;
}

export interface CreationWorkflowInput {
  checkpoint: CreationCheckpoint;
  createPayload: CreateDocumentRequest;
  requisites?: UpdateDocumentRequest;
  expectedDocumentNumber?: string;
  mainFile?: File;
  mainFileRequired: boolean;
  attachments?: File[];
  route?: SigningRouteRequest;
  submit: boolean;
  operations: CreationWorkflowOperations;
  persist: (checkpoint: CreationCheckpoint) => void;
}

export const runCreationWorkflow = async (input: CreationWorkflowInput): Promise<CreationCheckpoint> => {
  let checkpoint = input.checkpoint;
  const advance = (stage: CreationStage, patch: Partial<CreationCheckpoint> = {}) => {
    checkpoint = { ...checkpoint, ...patch, stage, updatedAt: new Date().toISOString() };
    input.persist(checkpoint);
  };

  if (!reached(checkpoint.stage, 'DOCUMENT_CREATED')) {
    const document = await input.operations.createDocument(input.createPayload, checkpoint.idempotencyKey);
    advance('DOCUMENT_CREATED', { documentId: document.id, backendVersion: document.version });
  }
  const documentId = checkpoint.documentId!;

  if (!reached(checkpoint.stage, 'REQUISITES_UPDATED')) {
    if (input.requisites && Object.keys(input.requisites).length > 0) {
      await input.operations.updateDocument(documentId, input.requisites);
      const actual = await input.operations.getDocument(documentId);
      if (input.expectedDocumentNumber !== undefined && actual.number !== input.expectedDocumentNumber) {
        throw new Error('Backend не подтвердил сохранение номера документа после PATCH.');
      }
      advance('REQUISITES_UPDATED', { backendVersion: actual.version });
    } else {
      advance('REQUISITES_UPDATED');
    }
  }

  if (!reached(checkpoint.stage, 'MAIN_FILE_UPLOADED')) {
    const actual = await input.operations.getDocument(documentId);
    if (actual.currentVersionId !== null) {
      advance('MAIN_FILE_UPLOADED', { backendVersion: actual.version });
    } else if (input.mainFile) {
      await input.operations.uploadMainFile(documentId, input.mainFile);
      const afterUpload = await input.operations.getDocument(documentId);
      advance('MAIN_FILE_UPLOADED', { backendVersion: afterUpload.version });
    } else if (input.mainFileRequired) {
      throw new Error('Выберите основной файл для продолжения создания документа.');
    } else {
      return checkpoint;
    }
  }

  if (!reached(checkpoint.stage, 'ATTACHMENTS_UPLOADED')) {
    const files = input.attachments ?? [];
    const existing = await input.operations.listAttachments(documentId);
    for (let index = checkpoint.uploadedAttachmentIds.length; index < files.length; index += 1) {
      const file = files[index];
      const reconciled = existing.find((item) => !checkpoint.uploadedAttachmentIds.includes(item.id)
        && item.originalFileName === file.name && item.fileSize === file.size);
      const attachment = reconciled ?? await input.operations.uploadAttachment(documentId, file);
      checkpoint = { ...checkpoint, uploadedAttachmentIds: [...checkpoint.uploadedAttachmentIds, attachment.id] };
      input.persist(checkpoint);
    }
    advance('ATTACHMENTS_UPLOADED');
  }

  if (!input.submit) return checkpoint;
  if (!input.route) throw new Error('Маршрут подписания не задан.');

  if (!reached(checkpoint.stage, 'ROUTE_CREATED')) {
    const existing = await input.operations.getSigningRoute(documentId);
    const route = existing ?? await input.operations.createSigningRoute(documentId, input.route);
    advance('ROUTE_CREATED', { routeId: route.id });
  }

  if (!reached(checkpoint.stage, 'PREPARED')) {
    const current = await input.operations.getDocument(documentId);
    await input.operations.prepare(documentId, current.version);
    advance('PREPARED', { backendVersion: current.version });
  }

  if (!reached(checkpoint.stage, 'SENT')) {
    const currentRoute = await input.operations.getSigningRoute(documentId);
    if (currentRoute?.status !== 'ACTIVE' && currentRoute?.status !== 'COMPLETED') {
      await input.operations.send(documentId);
    }
    advance('SENT');
  }
  advance('COMPLETED');
  return checkpoint;
};
