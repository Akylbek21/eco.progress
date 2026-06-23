import { useState } from 'react';

type Props = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
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
  priority = false,
  fill = false,
  wrapperClassName = '',
  className = '',
}: Props) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className={`${fill ? 'absolute inset-0' : 'relative'} overflow-hidden bg-slate-200 ${wrapperClassName}`}>
      {!loaded && !failed && <div aria-hidden="true" className="route-skeleton absolute inset-0 bg-slate-200" />}
      {!failed && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        />
      )}
    </div>
  );
};

export default ResponsiveImage;
