export default function StepDot({ n, current, label }) {
  const isComplete = n < current;
  const isCurrent = n === current;

  return (
    <div className={`step-dot ${isComplete ? "is-complete" : ""} ${isCurrent ? "is-current" : ""}`}>
      <span className="step-dot__circle" aria-hidden="true">
        {isComplete ? "✓" : n + 1}
      </span>
      <span className="step-dot__label">{label}</span>
    </div>
  );
}
