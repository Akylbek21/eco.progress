import { useState } from 'react';

type Props = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  avifSrcSet?: string;
  webpSrcSet?: string;
  fallbackSrcSet?: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
  wrapperClassName?: string;
  className?: string;
};

const ResponsiveImage = ({
  src,
  alt,
  width = 1200,
  height = 675,
  avifSrcSet,
  webpSrcSet,
  fallbackSrcSet,
  sizes = '(max-width: 640px) 100vw, 50vw',
  priority = false,
  fill = false,
  wrapperClassName = '',
  className = '',
}: Props) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const legacyResponsiveNames: Record<string, string> = {
    '/cottonbro.jpg': 'ekologicheskoe-proektirovanie',
    '/edward.jpg': 'laboratornye-izmereniya',
    '/jose.jpg': 'vyvoz-othodov',
    '/pexels-enginakyurt.jpg': 'ekologicheskiy-monitoring',
    '/pexels-jan-van.jpg': 'otbor-prob-vody',
    '/para.jpg': 'ecoprogress-og-cover',
    '/images (1).jpg': 'ekologicheskoe-soprovozhdenie',
    '/utilizacija-othodov-3.jpg': 'utilizaciya-othodov',
    '/poligon-tbo-2.jpg': 'poligon-tbo',
  };
  const responsiveMatch = src.match(/^\/media\/(.+)-(?:480|768|1024|1280|1920)\.(?:jpg|jpeg|png|webp|avif)$/);
  const responsiveName = responsiveMatch?.[1] || legacyResponsiveNames[src];
  const autoSet = (extension: 'avif' | 'webp' | 'jpg') => responsiveName
    ? [480, 768, 1024, 1280, 1920].map((value) => `/media/${responsiveName}-${value}.${extension} ${value}w`).join(', ')
    : undefined;
  const resolvedAvifSrcSet = avifSrcSet || autoSet('avif');
  const resolvedWebpSrcSet = webpSrcSet || autoSet('webp');
  const resolvedFallbackSrcSet = fallbackSrcSet || autoSet('jpg');
  const resolvedSrc = responsiveName ? `/media/${responsiveName}-1280.jpg` : src;
  const fetchPriorityAttribute = priority ? { fetchpriority: 'high' } : {};

  return (
    <div className={`${fill ? 'absolute inset-0' : 'relative'} overflow-hidden bg-slate-200 ${wrapperClassName}`}>
      {!loaded && !failed && <div aria-hidden="true" className="route-skeleton absolute inset-0 bg-slate-200" />}
      {!failed && (
        <picture>
          {resolvedAvifSrcSet && <source type="image/avif" srcSet={resolvedAvifSrcSet} sizes={sizes} />}
          {resolvedWebpSrcSet && <source type="image/webp" srcSet={resolvedWebpSrcSet} sizes={sizes} />}
          <img
            src={resolvedSrc}
            srcSet={resolvedFallbackSrcSet}
            sizes={resolvedFallbackSrcSet ? sizes : undefined}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            {...fetchPriorityAttribute}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`h-full w-full transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
          />
        </picture>
      )}
    </div>
  );
};

export default ResponsiveImage;
