import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const skeletonClass = 'route-skeleton rounded-2xl bg-slate-200/75';

export const ImageSkeleton = ({ className = '' }: { className?: string }) => (
  <div aria-hidden="true" className={`${skeletonClass} aspect-[16/9] w-full ${className}`} />
);

export const HeroSkeleton = () => (
  <section className="bg-gradient-to-br from-eco-900 via-eco-800 to-eco-700 px-5 py-16 sm:px-8 sm:py-20">
    <div className="mx-auto grid min-h-[360px] max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-5">
        <div className="route-skeleton h-5 w-36 rounded-full bg-white/20" />
        <div className="route-skeleton h-12 w-full max-w-2xl rounded-2xl bg-white/20 sm:h-16" />
        <div className="route-skeleton h-5 w-full max-w-xl rounded-xl bg-white/15" />
        <div className="route-skeleton h-5 w-4/5 max-w-lg rounded-xl bg-white/15" />
        <div className="flex gap-3 pt-3">
          <div className="route-skeleton h-12 w-40 rounded-full bg-white/20" />
          <div className="route-skeleton h-12 w-32 rounded-full bg-white/15" />
        </div>
      </div>
      <ImageSkeleton className="hidden rounded-[28px] bg-white/15 lg:block" />
    </div>
  </section>
);

export const CardsSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }).map((_, index) => (
      <article key={index} className="rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-sm">
        <ImageSkeleton className="aspect-[5/3]" />
        <div className="mt-5 space-y-3">
          <div className={`${skeletonClass} h-5 w-3/4`} />
          <div className={`${skeletonClass} h-4 w-full`} />
          <div className={`${skeletonClass} h-4 w-5/6`} />
        </div>
      </article>
    ))}
  </div>
);

export const PageSkeleton = () => (
  <div className="min-h-[70vh] bg-[#F7FBFD]">
    <HeroSkeleton />
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="mb-8 space-y-3">
        <div className={`${skeletonClass} h-5 w-32`} />
        <div className={`${skeletonClass} h-9 w-full max-w-lg`} />
        <div className={`${skeletonClass} h-4 w-full max-w-2xl`} />
      </div>
      <CardsSkeleton />
    </section>
  </div>
);

type ProgressContextValue = {
  start: () => () => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export const RouteProgressProvider = ({ children }: { children: ReactNode }) => {
  const activeRef = useRef(0);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAtRef = useRef(0);
  const visibleRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const start = useCallback(() => {
    activeRef.current += 1;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!visible && !showTimerRef.current) {
      showTimerRef.current = setTimeout(() => {
        if (activeRef.current > 0) {
          shownAtRef.current = Date.now();
          visibleRef.current = true;
          setFinishing(false);
          setVisible(true);
        }
        showTimerRef.current = null;
      }, 150);
    }

    return () => {
      activeRef.current = Math.max(0, activeRef.current - 1);
      if (activeRef.current > 0) return;
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (!visibleRef.current) return;
      const remaining = Math.max(0, 150 - (Date.now() - shownAtRef.current));
      hideTimerRef.current = setTimeout(() => {
        setFinishing(true);
        hideTimerRef.current = setTimeout(() => {
          setVisible(false);
          visibleRef.current = false;
          setFinishing(false);
          hideTimerRef.current = null;
        }, 180);
      }, Math.min(remaining, 400));
    };
  }, []);

  useEffect(() => () => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const contextValue = useMemo(() => ({ start }), [start]);

  return (
    <ProgressContext.Provider value={contextValue}>
      {children}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className={`route-progress h-full bg-gradient-to-r from-eco-400 via-accent to-eco-300 ${finishing ? 'route-progress-finish' : ''}`} />
      </div>
    </ProgressContext.Provider>
  );
};

export const PageLoader = () => {
  const progress = useContext(ProgressContext);

  useEffect(() => {
    const stop = progress?.start();
    return () => {
      stop?.();
    };
  }, [progress]);

  return (
    <div className="min-h-[70vh] bg-[#F7FBFD]" aria-busy="true" aria-label="Загрузка страницы">
      <PageSkeleton />
    </div>
  );
};

export default PageLoader;
