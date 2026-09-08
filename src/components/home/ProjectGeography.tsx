import { useEffect, useRef } from 'react';

/** The vanilla Three.js section keeps its own styles and matches its content height. */
export default function ProjectGeography() {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let observer: ResizeObserver | undefined;
    const observe = () => {
      observer?.disconnect();
      const section = frame.contentDocument?.querySelector('section');
      if (!section) return;
      const resize = () => { frame.style.height = `${Math.ceil(section.getBoundingClientRect().height)}px`; };
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(section);
    };
    frame.addEventListener('load', observe);
    observe();
    return () => { frame.removeEventListener('load', observe); observer?.disconnect(); };
  }, []);
  return (
    <section id="project-geography" aria-label="География наших проектов" className="bg-[#081719]">
      <iframe ref={ref} src="/project-geography/index.html" title="География наших проектов — интерактивная 3D-карта Казахстана" loading="lazy" className="block h-[770px] w-full border-0 md:h-[930px]" />
    </section>
  );
}
