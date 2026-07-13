import { ImgHTMLAttributes, ReactNode, useEffect, useState } from 'react';
import api from '../../services/api';

type AuthenticatedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string;
  fallback?: ReactNode;
};

const apiPathFromSrc = (src: string) => {
  if (!src || src.startsWith('blob:') || src.startsWith('data:')) return null;

  try {
    const url = new URL(src, window.location.origin);
    if (url.pathname.startsWith('/api/')) return `${url.pathname.slice(4)}${url.search}`;
    if (url.pathname.startsWith('/settings/')) return `${url.pathname}${url.search}`;
    return null;
  } catch {
    if (src.startsWith('/api/')) return src.slice(4);
    if (src.startsWith('/settings/')) return src;
    return null;
  }
};

const AuthenticatedImage = ({ src = '', fallback = null, ...props }: AuthenticatedImageProps) => {
  const [resolvedSrc, setResolvedSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);

    const requestPath = apiPathFromSrc(src);
    if (!requestPath) {
      setResolvedSrc(src);
      return;
    }

    let active = true;
    let objectUrl = '';
    setResolvedSrc('');

    api.get<Blob>(requestPath, { responseType: 'blob' })
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setResolvedSrc(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!src || failed || !resolvedSrc) return <>{fallback}</>;

  return <img src={resolvedSrc} {...props} />;
};

export default AuthenticatedImage;
