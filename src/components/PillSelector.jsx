export default function PillSelector({ legend, options, value, onChange, name }) {
  return (
    <fieldset className="pill-selector">
      <legend>{legend}</legend>
      <div className="pill-selector__options">
        {options.map((option) => {
          const isActive = option === value;
          return (
            <button
              key={option}
              type="button"
              className={`pill-selector__button ${isActive ? "is-active" : ""}`}
              aria-pressed={isActive}
              name={name}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
