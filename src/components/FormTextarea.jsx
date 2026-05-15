export default function FormTextarea({
  id,
  label,
  helperText,
  error,
  className = "",
  ...props
}) {
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`form-group ${className}`.trim()}>
      <label className="form-label" htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className="form-control"
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : "false"}
        {...props}
      />
      {helperText && <p className="form-helper" id={helperId}>{helperText}</p>}
      {error && <p className="form-error" id={errorId}>{error}</p>}
    </div>
  );
}
