import clsx from 'clsx';

const BrandLogo = ({ className }: { className?: string; dark?: boolean }) => (
  <span
    className={clsx(
      'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[18px]',
      className
    )}
    aria-hidden="true"
  >
    <img
      src="/Без имени.png"
      alt=""
      className="h-full w-full scale-[2.95] object-contain opacity-95"
    />
  </span>
);

export default BrandLogo;
