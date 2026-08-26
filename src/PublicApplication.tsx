import { ToastProvider } from './components/ui/ToastProvider';
import PublicApp from './PublicApp';

/**
 * Shared public application tree used below the router by both the browser and
 * the prerender server. Keep public providers here so SSR and hydration cannot
 * silently drift apart.
 */
export default function PublicApplication() {
  return (
    <ToastProvider>
      <PublicApp />
    </ToastProvider>
  );
}
