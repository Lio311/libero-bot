// liberoBot mark: a perfume bottle whose body reads as a bot's face. The atomizer nozzle
// doubles as the antenna; the right eye is lit in the accent colour, like a scanning LED.

export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect x="6" y="11" width="20" height="17.5" rx="5" stroke="currentColor" strokeWidth="2.2" />
      <path d="M12.5 11V8.2a1.2 1.2 0 0 1 1.2-1.2h4.6a1.2 1.2 0 0 1 1.2 1.2V11" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 7V3.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="3" r="1.5" fill="var(--accent)" />
      <rect x="9.5" y="16" width="13" height="7" rx="3.5" fill="currentColor" opacity="0.09" />
      <circle cx="12.9" cy="19.5" r="1.55" fill="currentColor" />
      <circle cx="19.1" cy="19.5" r="1.55" fill="var(--accent)" className="logo-eye" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span dir="ltr" className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[-0.02em]">
        libero<span className="text-accent">Bot</span>
      </span>
    </span>
  );
}
