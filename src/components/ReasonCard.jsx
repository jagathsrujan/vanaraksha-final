export default function ReasonCard({ title, children, accent = "var(--info)" }) {
  return (
    <article className="reason-card" style={{ "--accent-color": accent }}>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}
