import type { QueryClient } from '@tanstack/react-query';

export const clearCompanyQueries = (queryClient: QueryClient): void => {
  queryClient.removeQueries({ queryKey: ['companies'] });
  queryClient.removeQueries({ queryKey: ['company'] });
  queryClient.removeQueries({ queryKey: ['company-objects'] });
};

