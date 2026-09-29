/**
 * hidroBIntel — HexIcon
 *
 * Sustituye los emoji del portal (🤖 📊 💰) por el sistema hexagonal del
 * BrandKit Hidrobart. El hexágono es la forma identitaria de la marca: aparece
 * en el isotipo, en los patrones y como contenedor de las seis extensiones
 * visuales (crecimiento, flujo, sistema, excelencia, innovación, equipos).
 *
 * Los emoji renderizaban distinto en cada sistema operativo y no comunicaban
 * marca. Estos íconos son SVG, heredan el color del módulo y escalan sin pérdida.
 */

export type HexGlyph =
  | "flujo"
  | "crecimiento"
  | "excelencia"
  | "equipos"
  | "innovacion"
  | "sistema"
  | "calendario"
  | "documento"
  | "mapa";

/** Trazos internos de cada extensión visual, sobre un lienzo de 100 × 115. */
const GLYPHS: Record<HexGlyph, React.ReactNode> = {
  flujo: (
    <path
      d="M32 58h36M56 46l12 12-12 12"
      fill="none"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  crecimiento: (
    <path
      d="M32 68l12-14 10 9 14-19"
      fill="none"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  excelencia: (
    <>
      <circle cx={50} cy={50} r={10} fill="none" strokeWidth={5} />
      <path d="M32 80a18 18 0 0 1 36 0" fill="none" strokeWidth={5} strokeLinecap="round" />
    </>
  ),
  equipos: (
    <>
      <circle cx={40} cy={47} r={8} fill="none" strokeWidth={5} />
      <circle cx={62} cy={47} r={8} fill="none" strokeWidth={5} />
      <path
        d="M28 78a13 13 0 0 1 24 0M50 78a13 13 0 0 1 24 0"
        fill="none"
        strokeWidth={5}
        strokeLinecap="round"
      />
    </>
  ),
  innovacion: (
    <>
      <path d="M50 34v46M34 46l32 22M66 46L34 68" fill="none" strokeWidth={5} strokeLinecap="round" />
      <circle cx={50} cy={34} r={6} stroke="none" />
      <circle cx={34} cy={68} r={6} stroke="none" />
      <circle cx={66} cy={68} r={6} stroke="none" />
    </>
  ),
  sistema: (
    <path d="M34 74V56M50 74V40M66 74V62" fill="none" strokeWidth={7} strokeLinecap="round" />
  ),
  calendario: (
    <>
      <rect x={32} y={40} width={36} height={34} rx={4} fill="none" strokeWidth={5} />
      <path d="M32 52h36M42 34v10M58 34v10" fill="none" strokeWidth={5} strokeLinecap="round" />
    </>
  ),
  documento: (
    <>
      <path d="M36 38h22l10 10v30H36z" fill="none" strokeWidth={5} strokeLinejoin="round" />
      <path d="M44 60h16M44 68h16" fill="none" strokeWidth={4.5} strokeLinecap="round" />
    </>
  ),
  mapa: (
    <>
      <path
        d="M32 42l12-5 12 5 12-5v36l-12 5-12-5-12 5z"
        fill="none"
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M44 37v36M56 42v36" fill="none" strokeWidth={4.5} />
    </>
  ),
};

interface Props {
  /** Extensión visual de marca a dibujar dentro del hexágono. */
  glyph: HexGlyph;
  /** Color del módulo. Cualquier valor CSS; normalmente un token de catálogo. */
  color: string;
  /** Alto en píxeles. El ancho se calcula con la proporción del hexágono. */
  size?: number;
  className?: string;
}

export default function HexIcon({ glyph, color, size = 46, className = "" }: Props) {
  const width = Math.round((size * 100) / 115);
  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 100 115"
      className={className}
      role="presentation"
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      {/* Hexágono exterior: relleno tenue del color del módulo */}
      <polygon
        points="50,0 100,28.75 100,86.25 50,115 0,86.25 0,28.75"
        fill={color}
        opacity={0.2}
      />
      {/* Hexágono interior: contorno */}
      <polygon
        points="50,12 89,34.5 89,79.5 50,102 11,79.5 11,34.5"
        fill="none"
        stroke={color}
        strokeWidth={5}
      />
      {/* Trazo de la extensión visual */}
      <g stroke={color} fill={color}>
        {GLYPHS[glyph]}
      </g>
    </svg>
  );
}

/** Isotipo Hidrobart en hexágono — para la marca del topbar. */
export function IsotipoHex({ size = 38, className = "" }: { size?: number; className?: string }) {
  const width = Math.round((size * 100) / 115);
  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 100 115"
      className={className}
      role="img"
      aria-label="Hidrobart"
      style={{ flex: "none" }}
    >
      <polygon points="50,0 100,28.75 100,86.25 50,115 0,86.25 0,28.75" fill="#3A5DAE" />
      <polygon points="18,20 18,95 0,86.25 0,28.75" fill="#6CACE4" />
      <path
        d="M32 88 V44 h13 v10 a17 17 0 0 1 30 11 v23 h-13 V66 a5 5 0 0 0-10 0 v22 z"
        fill="#fff"
      />
    </svg>
  );
}
