import { ReactNode, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

type Direction = 'up' | 'down' | 'left' | 'right' | 'scale' | 'fade';

type RevealProps = {
  children: ReactNode;
  delay?: number;
  direction?: Direction;
  duration?: number;
  className?: string;
};

const hiddenClass: Record<Direction, string> = {
  up: 'translate-y-8 opacity-0',
  down: '-translate-y-8 opacity-0',
  left: 'translate-x-8 opacity-0',
  right: '-translate-x-8 opacity-0',
  scale: 'scale-95 opacity-0',
  fade: 'opacity-0',
};

const Reveal = ({ children, delay = 0, direction = 'up', duration = 650, className }: RevealProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={clsx('transition-all will-change-transform', visible ? 'translate-x-0 translate-y-0 scale-100 opacity-100' : hiddenClass[direction], className)}
      style={{ transitionDelay: `${delay}s`, transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
};

export default Reveal;
