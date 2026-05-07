export function RemloLogo({ size = 36, className = "", animate = false }: { size?: number; className?: string; animate?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${animate ? 'logo-animated' : ''}`}
    >
      <circle cx="20" cy="20" r="20" fill="#00E6A0"/>
      <path
        d="M22 10 L14 22 H19 L17 30 L26 18 H21 L22 10Z"
        fill="#080C14"
        stroke="#080C14"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RemloWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-heading font-bold tracking-tight ${className}`}>
      <span style={{ color: '#E8ECF4', fontWeight: 700 }}>Rem</span><span style={{ color: '#00E6A0', fontWeight: 700 }}>lo</span>
    </span>
  );
}
