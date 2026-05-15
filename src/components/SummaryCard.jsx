export default function SummaryCard({ title, children, accent = "var(--primary)" }) {
  return (
    <article className="summary-card" style={{ "--accent-color": accent }}>
      <h3>{title}</h3>
      {children}
    </article>
  );
}
