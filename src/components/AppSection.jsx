export default function AppSection({
  title,
  children,
  headingRef,
  id,
  size = "narrow",
  intro,
  className = "",
}) {
  return (
    <section
      className={`app-section app-section--${size} slide-up ${className}`.trim()}
      aria-labelledby={id}
    >
      <h2 ref={headingRef} id={id} className="app-section__heading" tabIndex="-1">
        {title}
      </h2>
      {intro && <p className="app-section__intro">{intro}</p>}
      {children}
    </section>
  );
}
