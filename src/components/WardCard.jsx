import TierBadge from "./TierBadge";

export default function WardCard({ ward, isInterpolated = false }) {
  if (!ward) return null;

  const interpolated = Boolean(isInterpolated || ward.isInterpolated);
  const pins = Array.isArray(ward.pins) && ward.pins.length ? `PIN ${ward.pins.join(", ")}` : "PIN data unavailable";

  return (
    <article className={`ward-card ${interpolated ? "is-interpolated" : ""}`}>
      <div className="ward-card__title-row">
        <div>
          <h3>{ward.label}</h3>
          <p className="ward-card__meta">
            {ward.zone || "Unknown zone"} · {pins}
            {interpolated && ward.confidencePenaltyPct ? ` · ${ward.confidencePenaltyPct}% confidence penalty` : ""}
          </p>
        </div>
        <TierBadge tier={ward.flood} size="md" />
      </div>

      <div className="ward-card__grid" aria-label="Ward risk tiers">
        <div className="ward-card__metric">
          <span>🌊 Flood</span>
          <TierBadge tier={ward.flood} size="sm" />
        </div>
        <div className="ward-card__metric">
          <span>🌡️ UHI</span>
          <TierBadge tier={ward.uhi} size="sm" />
        </div>
        <div className="ward-card__metric">
          <span>💧 Water</span>
          <TierBadge tier={ward.water} size="sm" />
        </div>
      </div>

      {ward.notes && <p className="ward-card__notes">{ward.notes}</p>}

      {interpolated && (
        <div className="ward-card__warning">
          ⚠️ {ward.interpolationNote || `Interpolated from ${ward.label}.`}{" "}
          {ward.interpolationDistanceKm ? `Approximate distance: ${ward.interpolationDistanceKm} km.` : ""}
        </div>
      )}
    </article>
  );
}
