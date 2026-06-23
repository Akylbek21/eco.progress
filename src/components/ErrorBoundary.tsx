import { Component, type ErrorInfo, type ReactNode } from 'react';
import Button from './ui/Button';

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = {
  error: Error | null;
};

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error boundary', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm">
        <h1 className="text-xl font-black">{this.props.fallbackTitle || 'Не удалось открыть страницу'}</h1>
        <p className="mt-2 text-sm font-semibold">Интерфейс перехватил ошибку и не завершил работу приложения.</p>
        <p className="mt-2 rounded-xl bg-white/70 p-3 text-sm">{this.state.error.message}</p>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => window.location.reload()}>
          Обновить страницу
        </Button>
      </div>
    );
  }
}

export default ErrorBoundary;
