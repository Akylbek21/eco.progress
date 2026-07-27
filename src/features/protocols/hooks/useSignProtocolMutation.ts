import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { normalizeApiError } from '../../../services/apiHelpers';
import protocolService from '../../../services/protocolService';
import type { SignProtocolResponse } from '../../../types/protocols';

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

type SignVariables = { protocolId: string | number; version: number };
type Options = {
  onSigned?: (response: SignProtocolResponse) => void | Promise<void>;
  onError?: (message: string, error: unknown) => void | Promise<void>;
};

export const useSignProtocolMutation = (
  protocolId: string | number | undefined,
  options: Options = {},
) => {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);
  const mutation = useMutation({
    mutationKey: ['sign-protocol', String(protocolId ?? '')],
    mutationFn: ({ protocolId: id, version }: SignVariables) =>
      protocolService.signProtocol(id, version),
    retry: false,
    onSuccess: async (response, variables) => {
      await options.onSigned?.(response);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['protocol', String(variables.protocolId)] }),
        queryClient.invalidateQueries({ queryKey: ['protocol', variables.protocolId] }),
        queryClient.invalidateQueries({ queryKey: ['protocols'] }),
        queryClient.invalidateQueries({ queryKey: ['protocol-signatures', String(variables.protocolId)] }),
      ]);
    },
    onError: async (error, variables) => {
      const normalized = normalizeApiError(error);
      if (normalized.code === 'PROTOCOL_VERSION_CONFLICT') {
        await queryClient.invalidateQueries({ queryKey: ['protocol', String(variables.protocolId)] });
      }
      await options.onError?.(protocolSignErrorMessage(error), error);
    },
    onSettled: () => {
      inFlightRef.current = false;
    },
  });
  return {
    ...mutation,
    sign: (variables: SignVariables) => {
      if (inFlightRef.current || mutation.isPending) return;
      inFlightRef.current = true;
      mutation.mutate(variables);
    },
  };
};
