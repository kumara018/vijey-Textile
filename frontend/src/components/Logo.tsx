export function LogoMark({ className = '', size = 32 }: { className?: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon-mark.jpg"
      alt="Vijey Textile"
      width={size}
      height={size}
      className={`rounded-full object-cover flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className="text-gold-500 flex-shrink-0" size={34} />
      <div className="hidden sm:block leading-tight">
        <p className="font-bold text-maroon-900 uppercase" style={{ letterSpacing: '0.04em', fontSize: '15px' }}>
          Vijey Textile
        </p>
        <p className="font-semibold text-maroon-500 uppercase" style={{ letterSpacing: '0.1em', fontSize: '9.5px' }}>
          Luxury Kid&apos;s &amp; Girls Clothing
        </p>
      </div>
    </div>
  );
}
