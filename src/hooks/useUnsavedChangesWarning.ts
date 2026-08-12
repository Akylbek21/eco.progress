import { useEffect } from 'react';

const DEFAULT_MESSAGE = 'Есть несохранённые изменения. Закрыть форму?';

/**
 * BrowserRouter does not expose a navigation blocker, so history indexes are used
 * to restore the current entry when Back/Forward is cancelled.
 */
export const useUnsavedChangesWarning = (enabled: boolean, message = DEFAULT_MESSAGE): void => {
  useEffect(() => {
    if (!enabled) return undefined;

    const currentIndex = Number(window.history.state?.idx);
    let restoringHistory = false;

    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const preventInternalNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof HTMLElement
        ? event.target.closest('a[href]') as HTMLAnchorElement | null
        : null;
      if (!target || target.target === '_blank' || target.origin !== window.location.origin) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const preventHistoryNavigation = (event: PopStateEvent) => {
      if (restoringHistory) {
        restoringHistory = false;
        return;
      }
      if (window.confirm(message)) return;

      const nextIndex = Number(event.state?.idx);
      if (Number.isFinite(currentIndex) && Number.isFinite(nextIndex) && currentIndex !== nextIndex) {
        restoringHistory = true;
        window.history.go(currentIndex - nextIndex);
      }
    };

    window.addEventListener('beforeunload', preventUnload);
    window.addEventListener('popstate', preventHistoryNavigation);
    document.addEventListener('click', preventInternalNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', preventUnload);
      window.removeEventListener('popstate', preventHistoryNavigation);
      document.removeEventListener('click', preventInternalNavigation, true);
    };
  }, [enabled, message]);
};

