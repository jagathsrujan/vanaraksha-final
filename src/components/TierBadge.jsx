const TIER_COLORS = {
  Low: { bg: "#d1fae5", border: "#059669", text: "#065f46" },
  Medium: { bg: "#fef3c7", border: "#d97706", text: "#92400e" },
  High: { bg: "#fee2e2", border: "#dc2626", text: "#991b1b" },
  Critical: { bg: "#991b1b", border: "#7f1d1d", text: "#fca5a5" },
};

export function normalizeTier(tier = "Medium") {
  if (TIER_COLORS[tier]) return tier;
  const value = String(tier || "").toLowerCase();
  if (value.includes("critical")) return "Critical";
  if (value.includes("high")) return "High";
  if (value.includes("low") && !value.includes("moderate")) return "Low";
  return "Medium";
}

export function getTierColors(tier = "Medium") {
  return TIER_COLORS[normalizeTier(tier)] || TIER_COLORS.Medium;
}

export default function TierBadge({ tier = "Medium", size = "md", label }) {
  const colors = getTierColors(tier);
  const display = label || tier || "Medium";

  return (
    <span
      className={`tier-badge tier-badge--${size}`}
      style={{
        "--tier-bg": colors.bg,
        "--tier-border": colors.border,
        "--tier-text": colors.text,
      }}
    >
      {display}
    </span>
  );
}
