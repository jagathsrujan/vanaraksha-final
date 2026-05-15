export default function ProgressTracker({ currentStep, totalSteps, label }) {
  const value = Math.round((currentStep / Math.max(totalSteps - 1, 1)) * 100);

  return (
    <div className="progress-tracker" aria-label={label || "Assessment progress"}>
      <div className="progress-tracker__meta">
        <span>{label || "Assessment progress"}</span>
        <span>{value}%</span>
      </div>
      <div
        className="progress-tracker__track"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-tracker__bar" style={{ "--progress-value": `${value}%` }} />
      </div>
    </div>
  );
}
