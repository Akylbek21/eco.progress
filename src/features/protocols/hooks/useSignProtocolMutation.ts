import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { normalizeApiError } from '../../../services/apiHelpers';
import protocolService from '../../../services/protocolService';
import type { Protocol } from '../../../types/protocols';
import { protocolQueryKeys, protocolScope } from './queryKeys';
import {
  createProtocolCmsSignature,
  type ProtocolSigningPhase,
} from '../utils/protocolSigning';
import { hasProtocolAction } from '../utils/protocolActions';

export const PROTOCOL_STALE_PDF_MESSAGE = 'PDF не соответствует согласованной версии протокола';
const STALE_PDF_ERROR_CODES = new Set([
  'PROTOCOL_CONTENT_CHANGED',
  'PDF_STALE',
  'STALE_PDF',
  'STALE_DOCUMENT',
  'PROTOCOL_DOCUMENT_STALE',
  'PROTOCOL_PDF_STALE',
  'PDF_NOT_CURRENT',
  'PDF_NOT_MATCH_APPROVED_CONTENT',
  'PDF_CONTENT_VERSION_MISMATCH',
  'DOCUMENT_VERSION_MISMATCH',
  'APPROVED_PDF_HASH_MISMATCH',
]);

const SIGN_ERROR_MESSAGES: Record<string, string> = {
  PROTOCOL_ALREADY_SIGNED: 'Вы уже подписали эту версию протокола',
  SIGNATURE_LIMIT_REACHED: 'Достигнуто максимальное количество подписей: 5',
  PROTOCOL_NOT_READY_FOR_SIGNING: 'Протокол ещё не готов к подписанию',
  PROTOCOL_VERSION_CONFLICT: 'Протокол был изменён другим сотрудником. Обновите данные',
  OPTIMISTIC_LOCK_CONFLICT: 'Протокол был изменён другим сотрудником. Обновите данные',
  FINAL_DOCUMENT_NOT_FOUND: 'Финальный документ не сформирован',
  ACCESS_DENIED: 'У вас нет доступа к подписанию протокола',
};

export const isProtocolStalePdfError = (error: unknown): boolean => {
  const code = normalizeApiError(error).code;
  return Boolean(code && STALE_PDF_ERROR_CODES.has(code));
};

export const protocolSignErrorMessage = (error: unknown): string => {
  const parsed = normalizeApiError(error, 'Не удалось подписать протокол');
  if (parsed.code && STALE_PDF_ERROR_CODES.has(parsed.code)) return PROTOCOL_STALE_PDF_MESSAGE;
  return parsed.code && SIGN_ERROR_MESSAGES[parsed.code]
    ? SIGN_ERROR_MESSAGES[parsed.code]
    : parsed.message;
};

type SignVariables = { protocol: Protocol };
type Options = {
  currentUserId?: string | number | null;
  onSigned?: (response: Protocol) => void | Promise<void>;
  onError?: (message: string, error: unknown) => void | Promise<void>;
};

export const useSignProtocolMutation = (
  protocolId: string | number | undefined,
  options: Options = {},
) => {
  const queryClient = useQueryClient();
  const scope = protocolScope(options.currentUserId);
  const inFlightRef = useRef(false);
  const [phase, setPhase] = useState<ProtocolSigningPhase>('IDLE');
  const mutation = useMutation({
    mutationKey: ['sign-protocol', String(protocolId ?? '')],
    mutationFn: async ({ protocol }: SignVariables) => {
      const current = protocol;
      if (!hasProtocolAction(current, 'sign')) {
        throw new Error('У вас нет права подписывать протокол. Передайте его руководителю.');
      }
      if (!current.hasPdf) throw new Error('Финальный PDF протокола не сформирован.');
      const file = await protocolService.downloadPdf(current.id);
      const cmsSignatureBase64 = await createProtocolCmsSignature(file.blob, setPhase);
      setPhase('VERIFYING_SIGNATURE');
      return protocolService.signProtocol(current.id, { cmsSignatureBase64, version: current.version });
    },
    retry: false,
    onSuccess: async (updatedProtocol, variables) => {
      queryClient.setQueryData(protocolQueryKeys.detail(scope, variables.protocol.id), updatedProtocol);
      await options.onSigned?.(updatedProtocol);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: protocolQueryKeys.lists(scope) }),
        queryClient.invalidateQueries({ queryKey: protocolQueryKeys.signatures(scope, variables.protocol.id) }),
        queryClient.invalidateQueries({ queryKey: protocolQueryKeys.documents(scope, variables.protocol.id) }),
      ]);
      setPhase('SIGNED');
    },
    onError: async (error) => {
      await options.onError?.(protocolSignErrorMessage(error), error);
    },
    onSettled: () => {
      inFlightRef.current = false;
      setPhase((current) => current === 'SIGNED' ? current : 'IDLE');
    },
  });
  return {
    ...mutation,
    phase,
    sign: (variables: SignVariables) => {
      if (inFlightRef.current || mutation.isPending) return;
      inFlightRef.current = true;
      mutation.mutate(variables);
    },
  };
};
