import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      let attempts = 0;
      let timer = 0;
      const scrollToHash = () => {
        const target = document.getElementById(hash.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
          return;
        }
        attempts += 1;
        if (attempts < 20) timer = window.setTimeout(scrollToHash, 50);
      };
      scrollToHash();
      return () => window.clearTimeout(timer);
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, search, hash]);

  return null;
};

export default ScrollToTop;
