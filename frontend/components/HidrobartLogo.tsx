"use client";

interface HidrobartLogoProps {
  size?: "icon" | "sm" | "md" | "lg";
  variant?: "light" | "dark" | "color";
  className?: string;
  showText?: boolean;
}

const sizes = {
  icon: { svg: 40, text: "text-xl" },
  sm: { svg: 32, text: "text-lg" },
  md: { svg: 48, text: "text-2xl" },
  lg: { svg: 64, text: "text-3xl" },
};

export default function HidrobartLogo({
  size = "md",
  variant = "light",
  className = "",
  showText = size !== "icon",
}: HidrobartLogoProps) {
  const { svg: svgSize, text: textSize } = sizes[size];
  const isLight = variant === "light";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Ícono SVG — gota de agua con letra H */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Fondo circular */}
        <circle cx="40" cy="40" r="40" fill={isLight ? "rgba(255,255,255,0.15)" : "#1E5FA8"} />

        {/* Gota de agua principal */}
        <path
          d="M40 12 C40 12 22 30 22 44 C22 54 30 62 40 62 C50 62 58 54 58 44 C58 30 40 12 40 12Z"
          fill={isLight ? "rgba(255,255,255,0.9)" : "#FFFFFF"}
          opacity="0.9"
        />

        {/* Ola interior de la gota */}
        <path
          d="M29 48 C33 43 37 50 40 48 C43 46 47 43 51 48"
          stroke={isLight ? "#00A3C4" : "#00A3C4"}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Letra H en la gota */}
        <text
          x="40"
          y="47"
          textAnchor="middle"
          fontSize="18"
          fontWeight="700"
          fontFamily="Poppins, Inter, sans-serif"
          fill={isLight ? "#0A2349" : "#0A2349"}
        >
          H
        </text>

        {/* Destello superior (reflejo) */}
        <ellipse
          cx="34"
          cy="30"
          rx="3"
          ry="5"
          fill="white"
          opacity="0.4"
          transform="rotate(-20 34 30)"
        />
      </svg>

      {/* Texto del logo */}
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-display font-bold tracking-wide ${textSize} ${
              isLight ? "text-white" : "text-hidrobart-800"
            }`}
          >
            HIDROBART
          </span>
          {size !== "sm" && (
            <span
              className={`text-[10px] font-medium tracking-[0.15em] uppercase mt-0.5 ${
                isLight ? "text-agua-400" : "text-agua-500"
              }`}
            >
              Sistemas Industriales
            </span>
          )}
        </div>
      )}
    </div>
  );
}
