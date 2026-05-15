import StepIndicator from "./StepIndicator";

const FOOTER_STEPS = ["Start", "Location", "Property", "Photos", "Testimony", "Results"];

export default function AppFooter({ currentStep }) {
  const steps = FOOTER_STEPS.map((label, index) => ({
    label,
    isComplete: index < currentStep,
    isCurrent: index === currentStep,
    isDisabled: index > currentStep,
  }));

  return (
    <nav className="app-footer" aria-label="Assessment steps">
      <div className="app-footer__inner">
        <StepIndicator steps={steps} />
      </div>
    </nav>
  );
}
