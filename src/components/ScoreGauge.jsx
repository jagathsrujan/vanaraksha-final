import TierBadge, { getTierColors } from "./TierBadge";

const CONFIDENCE_OPACITY = {
  High: 1,
  Medium: 0.7,
  Low: 0.4,
  "Very Low": 0.4,
};

export default function ScoreGauge({
  score = 0,
  tier = "Medium",
  label = "",
  confidence = "Medium",
}) {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  const colors = getTierColors(tier);
  const opacity = CONFIDENCE_OPACITY[confidence] ?? 0.7;

  return (
    <article className="score-gauge" aria-label={`${label}: ${safeScore} out of 100, ${tier} risk`}>
      <svg className="score-gauge__svg" viewBox="0 0 180 180" role="img" aria-hidden="true">
        <g transform="rotate(-90 90 90)">
          <circle
            cx="90"
            cy="90"
            r="70"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="14"
            opacity="0.3"
          />
          <circle
            className="score-gauge__arc"
            cx="90"
            cy="90"
            r="70"
            fill="none"
            stroke={colors.border}
            strokeWidth="14"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset={100 - safeScore}
            opacity={opacity}
          />
        </g>
        <text
          className="score-gauge__score"
          x="90"
          y="86"
          textAnchor="middle"
          style={{ "--gauge-color": colors.text }}
        >
          {safeScore}
        </text>
        <text className="score-gauge__sub" x="90" y="108" textAnchor="middle">
          / 100
        </text>
      </svg>
      <div className="score-gauge__label">{label}</div>
      <TierBadge tier={tier} size="sm" />
      <div className="score-gauge__confidence">Confidence: {confidence}</div>
    </article>
  );
}
