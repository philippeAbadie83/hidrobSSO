interface MicrosoftLogoProps {
  className?: string;
}

// Logo oficial de Microsoft (4 cuadrados de colores)
export default function MicrosoftLogo({ className = "w-5 h-5" }: MicrosoftLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Microsoft"
    >
      <rect x="0" y="0" width="10" height="10" fill="#F25022" />
      <rect x="11" y="0" width="10" height="10" fill="#7FBA00" />
      <rect x="0" y="11" width="10" height="10" fill="#00A4EF" />
      <rect x="11" y="11" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
