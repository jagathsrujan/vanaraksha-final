export default function StepIndicator({ steps }) {
  const currentIndex = Math.max(0, steps.findIndex((step) => step.isCurrent));

  return (
    <div
      className="step-indicator"
      role="progressbar"
      aria-label="Assessment step progress"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={steps.length}
    >
      {steps.map((step, index) => (
        <div
          key={step.label}
          className={[
            "step-indicator__item",
            step.isComplete ? "is-complete" : "",
            step.isCurrent ? "is-current" : "",
            step.isDisabled ? "is-disabled" : "",
          ].filter(Boolean).join(" ")}
          aria-current={step.isCurrent ? "step" : undefined}
        >
          <span className="step-indicator__circle" aria-hidden="true">
            {step.isComplete ? "✓" : index + 1}
          </span>
          <span className="step-indicator__label">{step.label}</span>
        </div>
      ))}
    </div>
  );
}
