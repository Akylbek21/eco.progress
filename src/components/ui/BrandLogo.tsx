import clsx from 'clsx';

const BrandLogo = ({ className, dark = true }: { className?: string; dark?: boolean }) => (
  <span
    className={clsx(
      'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-1',
      dark ? 'bg-eco-900 ring-white/15' : 'bg-white/10 ring-white/20',
      className
    )}
    aria-hidden="true"
  >
    <img
      src="/ChatGPT Image.png"
      alt=""
      className="h-full w-full object-contain opacity-95"
      style={{ transform: 'scale(2.85)' }}
    />
  </span>
);

export default BrandLogo;
