import { useEffect, useRef, useState } from "react";
import logoUrl from "../assets/logo.svg";

export default function AppHeader() {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <a className="app-header__brand" href="#/" aria-label="VanaRaksha home">
          <img src={logoUrl} alt="" aria-hidden="true" />
          <h1>VanaRaksha</h1>
        </a>

        <nav className="app-header__nav" aria-label="Primary">
          <a className="app-header__link" href="#/about">About</a>
          <a className="app-header__link" href="#/methodology">Methodology</a>
        </nav>

        <button
          ref={menuButtonRef}
          type="button"
          className="app-header__menu-button"
          aria-label="Open navigation menu"
          aria-controls="mobile-menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M4 7a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5Z"/>
          </svg>
        </button>
      </div>

      <div id="mobile-menu" className={`app-header__mobile-menu ${open ? "is-open" : ""}`}>
        <a href="#/about" onClick={() => setOpen(false)}>About</a>
        <a href="#/methodology" onClick={() => setOpen(false)}>Methodology</a>
      </div>
    </header>
  );
}
