import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { normalizeApiError } from '../../../services/apiHelpers';
import protocolService from '../../../services/protocolService';
import type { Protocol } from '../../../types/protocols';
import { protocolQueryKeys } from './queryKeys';
import {
  createProtocolCmsSignature,
  type ProtocolSigningPhase,
} from '../utils/protocolSigning';

const SIGN_ERROR_MESSAGES: Record<string, string> = {
  PROTOCOL_ALREADY_SIGNED: 'Вы уже подписали эту версию протокола',
  SIGNATURE_LIMIT_REACHED: 'Достигнуто максимальное количество подписей: 5',
  PROTOCOL_NOT_READY_FOR_SIGNING: 'Протокол ещё не готов к подписанию',
  PROTOCOL_VERSION_CONFLICT: 'Протокол был изменён другим сотрудником. Обновите данные',
  FINAL_DOCUMENT_NOT_FOUND: 'Финальный документ не сформирован',
  PROTOCOL_CONTENT_CHANGED: 'Документ изменился. Необходимо сформировать финальную версию заново',
  ACCESS_DENIED: 'У вас нет доступа к подписанию протокола',
};

export const protocolSignErrorMessage = (error: unknown): string => {
  const parsed = normalizeApiError(error, 'Не удалось подписать протокол');
  return parsed.code && SIGN_ERROR_MESSAGES[parsed.code]
    ? SIGN_ERROR_MESSAGES[parsed.code]
    : parsed.message;
};

type SignVariables = { protocol: Protocol };
type Options = {
  onSigned?: (response: Protocol) => void | Promise<void>;
  onError?: (message: string, error: unknown) => void | Promise<void>;
};

export const useSignProtocolMutation = (
  protocolId: string | number | undefined,
  options: Options = {},
) => {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);
  const [phase, setPhase] = useState<ProtocolSigningPhase>('IDLE');
  const mutation = useMutation({
    mutationKey: ['sign-protocol', String(protocolId ?? '')],
    mutationFn: async ({ protocol }: SignVariables) => {
      const fresh = await protocolService.getProtocol(String(protocol.id));
      if (!fresh.permissions?.canSign) throw new Error('Backend не разрешил подписание протокола.');
      if (!fresh.hasPdf) throw new Error('Финальный PDF протокола не сформирован.');
      const file = await protocolService.downloadPdf(fresh.id);
      const cmsSignatureBase64 = await createProtocolCmsSignature(file.blob, setPhase);
      setPhase('VERIFYING_SIGNATURE');
      try {
        return await protocolService.signProtocol(fresh.id, { cmsSignatureBase64 });
      } catch (error) {
        const actual = await protocolService.getProtocol(String(fresh.id)).catch(() => null);
        if (actual && (
          actual.version > fresh.version
          || actual.signatureCount > fresh.signatureCount
          || actual.signedByCurrentUser
        )) return actual;
        throw error;
      }
    },
    retry: false,
    onSuccess: async (updatedProtocol, variables) => {
      queryClient.setQueryData(protocolQueryKeys.detail(variables.protocol.id), updatedProtocol);
      queryClient.setQueryData(['protocol', String(variables.protocol.id)], updatedProtocol);
      await options.onSigned?.(updatedProtocol);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['protocols'] }),
        queryClient.invalidateQueries({ queryKey: ['protocol-signatures', String(variables.protocol.id)] }),
      ]);
      setPhase('SIGNED');
    },
    onError: async (error, variables) => {
      const normalized = normalizeApiError(error);
      if (normalized.code === 'PROTOCOL_VERSION_CONFLICT' || normalized.code === 'VERSION_CONFLICT') {
        const actual = await protocolService.getProtocol(String(variables.protocol.id)).catch(() => null);
        if (actual) {
          queryClient.setQueryData(protocolQueryKeys.detail(variables.protocol.id), actual);
          queryClient.setQueryData(['protocol', String(variables.protocol.id)], actual);
        }
      }
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
