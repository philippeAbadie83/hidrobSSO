"use client";

import Image from "next/image";

interface HidrobartLogoProps {
  size?: "icon" | "sm" | "md" | "lg";
  variant?: "light" | "dark" | "color";
  className?: string;
  showText?: boolean;
}

const IMAGOTIPO = "https://hidrobartmedia.blob.core.windows.net/imgs/logos/imagotipo_blanco-01.png";
const ISOTIPO   = "https://hidrobartmedia.blob.core.windows.net/imgs/logos/isotipo_blanco-03.png";

const iconSizes = { icon: 40, sm: 32, md: 48, lg: 64 };
const logoWidths = { icon: 40, sm: 140, md: 180, lg: 240 };

export default function HidrobartLogo({
  size = "md",
  variant = "light",
  className = "",
  showText = size !== "icon",
}: HidrobartLogoProps) {
  const useIcon = size === "icon" || !showText;
  const px = useIcon ? iconSizes[size] : logoWidths[size];

  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src={useIcon ? ISOTIPO : IMAGOTIPO}
        alt="Hidrobart"
        width={px}
        height={useIcon ? px : Math.round(px / 4)}
        className="object-contain"
        priority
        unoptimized
      />
    </div>
  );
}
