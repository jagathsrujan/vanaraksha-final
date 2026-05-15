import { WARD_DB } from "../data/WARD_DB";

const MAP = { width: 700, height: 500, padding: 40 };

const CITY_OUTLINE = [
  { lat: 13.151, lon: 77.586 },
  { lat: 13.128, lon: 77.666 },
  { lat: 13.060, lon: 77.733 },
  { lat: 12.995, lon: 77.780 },
  { lat: 12.945, lon: 77.750 },
  { lat: 12.902, lon: 77.668 },
  { lat: 12.878, lon: 77.591 },
  { lat: 12.902, lon: 77.520 },
  { lat: 12.970, lon: 77.460 },
  { lat: 13.035, lon: 77.508 },
  { lat: 13.098, lon: 77.534 },
];

const ALL_GEO_POINTS = [
  ...CITY_OUTLINE,
  ...Object.values(WARD_DB)
    .filter((ward) => ward.lat != null && ward.lon != null)
    .map((ward) => ({ lat: ward.lat, lon: ward.lon })),
];

const BOUNDS = {
  minLat: Math.min(...ALL_GEO_POINTS.map((point) => point.lat)) - 0.012,
  maxLat: Math.max(...ALL_GEO_POINTS.map((point) => point.lat)) + 0.012,
  minLon: Math.min(...ALL_GEO_POINTS.map((point) => point.lon)) - 0.012,
  maxLon: Math.max(...ALL_GEO_POINTS.map((point) => point.lon)) + 0.012,
};

function geoToPoint(lat, lon) {
  const x = MAP.padding + ((lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * (MAP.width - MAP.padding * 2);
  const y = MAP.padding + ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * (MAP.height - MAP.padding * 2);
  return { x, y };
}

function pointsToPath(points) {
  return points.map((point, index) => {
    const { x, y } = geoToPoint(point.lat, point.lon);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + " Z";
}

function clipPolygon(poly, a, b, c) {
  const result = [];
  for (let i = 0; i < poly.length; i += 1) {
    const current = poly[i];
    const previous = poly[(i + poly.length - 1) % poly.length];
    const currentInside = a * current.x + b * current.y <= c + 0.001;
    const previousInside = a * previous.x + b * previous.y <= c + 0.001;

    if (currentInside !== previousInside) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const denominator = a * dx + b * dy;
      if (Math.abs(denominator) > 0.001) {
        const t = (c - a * previous.x - b * previous.y) / denominator;
        result.push({ x: previous.x + t * dx, y: previous.y + t * dy });
      }
    }
    if (currentInside) result.push(current);
  }
  return result;
}

function buildWardCells(points) {
  const basePolygon = [
    { x: MAP.padding, y: MAP.padding },
    { x: MAP.width - MAP.padding, y: MAP.padding },
    { x: MAP.width - MAP.padding, y: MAP.height - MAP.padding },
    { x: MAP.padding, y: MAP.height - MAP.padding },
  ];

  return points.map((point) => {
    let polygon = basePolygon;
    for (const other of points) {
      if (other.key === point.key) continue;
      const a = 2 * (other.x - point.x);
      const b = 2 * (other.y - point.y);
      const c = other.x * other.x + other.y * other.y - point.x * point.x - point.y * point.y;
      polygon = clipPolygon(polygon, a, b, c);
      if (!polygon.length) break;
    }
    return { ...point, polygon };
  });
}

function polygonToPath(points) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ") + " Z";
}

export default function CoverageMap({ userLat, userLon }) {
  const wardPoints = Object.entries(WARD_DB)
    .filter(([, ward]) => ward.lat != null && ward.lon != null)
    .map(([key, ward]) => ({ key, ward, ...geoToPoint(ward.lat, ward.lon) }));
  const wardCells = buildWardCells(wardPoints);
  const coveredCount = wardPoints.filter(({ ward }) => Boolean(ward.flood)).length;
  const cityOutlinePath = pointsToPath(CITY_OUTLINE);

  return (
    <div className="coverage-map">
      <div className="coverage-map__meta">
        <span>Ward coverage</span>
        <span>{coveredCount}/{wardPoints.length} wards</span>
      </div>
      <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} role="img" aria-labelledby="coverage-map-title coverage-map-desc">
        <title id="coverage-map-title">Bengaluru ward coverage map</title>
        <desc id="coverage-map-desc">Schematic Bengaluru ward map with markers plotted from WARD_DB latitude and longitude values.</desc>
        <defs>
          <clipPath id="bengaluru-map-clip">
            <path d={cityOutlinePath} />
          </clipPath>
          <linearGradient id="coverage-map-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0fdf4" />
            <stop offset="52%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={MAP.width} height={MAP.height} rx="16" fill="url(#coverage-map-bg)" />
        <path d={cityOutlinePath} fill="#ffffff" opacity="0.86" stroke="#94a3b8" strokeWidth="2.5" />

        <g clipPath="url(#bengaluru-map-clip)">
          {wardCells.map(({ key, ward, polygon }, index) => {
            const hasData = Boolean(ward.flood);
            return (
              <path
                key={`${key}-cell`}
                d={polygonToPath(polygon)}
                fill={hasData ? (index % 2 ? "#ecfdf5" : "#f0f9ff") : "#f1f5f9"}
                stroke="#cbd5e1"
                strokeWidth="1"
                opacity="0.9"
              >
                <title>{ward.label} ward area</title>
              </path>
            );
          })}
          <path d={cityOutlinePath} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.55" />
        </g>

        <text x={MAP.width / 2} y="30" textAnchor="middle" fontSize="13" fill="#475569" fontWeight="800">
          Bengaluru Ward Coverage
        </text>

        {wardPoints.map(({ key, ward, x, y }) => {
          const hasData = Boolean(ward.flood);
          const isVerified = key === "koramangala";
          const fill = !hasData ? "#d1d5db" : isVerified ? "#059669" : "#3b82f6";

          return (
            <g key={key} className="coverage-map__marker">
              <circle
                cx={x}
                cy={y}
                r={isVerified ? 7.5 : 5.2}
                fill={fill}
                stroke="white"
                strokeWidth="2"
              />
              {isVerified && (
                <circle cx={x} cy={y} r="11" fill="none" stroke="#059669" strokeWidth="2" opacity="0.35" />
              )}
              <title>{ward.label}</title>
            </g>
          );
        })}

        {userLat && userLon && (() => {
          const { x, y } = geoToPoint(userLat, userLon);
          return (
            <g>
              <circle className="coverage-map__user-pulse" cx={x} cy={y} r="12" fill="#dc2626" opacity="0.25" />
              <circle cx={x} cy={y} r="6" fill="#dc2626" stroke="white" strokeWidth="2" />
            </g>
          );
        })()}

        <g transform={`translate(${MAP.width - 185}, 54)`}>
          <rect width="160" height="82" rx="8" fill="white" stroke="#e2e8f0" opacity="0.96" />
          <circle cx="16" cy="20" r="5" fill="#059669" />
          <text x="30" y="24" fontSize="12" fill="#1e293b">Verified</text>
          <circle cx="16" cy="42" r="5" fill="#3b82f6" />
          <text x="30" y="46" fontSize="12" fill="#1e293b">In DB</text>
          <circle cx="16" cy="64" r="5" fill="#d1d5db" />
          <text x="30" y="68" fontSize="12" fill="#1e293b">Uncovered</text>
        </g>
      </svg>
    </div>
  );
}
