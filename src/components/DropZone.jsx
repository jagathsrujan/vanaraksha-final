import { useRef, useState } from "react";

export default function DropZone({ onFiles, disabled = false }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleFiles = (fileList) => {
    if (!disabled && fileList?.length) onFiles(Array.from(fileList));
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div
      className={`drop-zone ${dragging ? "is-dragging" : ""}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Drop photos here or click to upload"
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        multiple
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="drop-zone__content">
        <svg className="drop-zone__icon" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
          <path fill="currentColor" d="M22 7a2 2 0 0 1 2 2v11h11a2 2 0 1 1 0 4H24v11a2 2 0 1 1-4 0V24H9a2 2 0 1 1 0-4h11V9a2 2 0 0 1 2-2Z"/>
          <path fill="currentColor" fillOpacity=".18" d="M8 10a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V10Zm4-1a1 1 0 0 0-1 1v18l6.2-6.2a3 3 0 0 1 4.2 0l2.1 2.1 4.2-4.2a3 3 0 0 1 4.2 0L33 20.8V10a1 1 0 0 0-1-1H12Z"/>
        </svg>
        <span className="drop-zone__title">Drop photos here or click to upload</span>
        <span className="drop-zone__hint">Image files only, up to 5 photos</span>
      </div>
    </div>
  );
}
