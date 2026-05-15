export default function PrintCSS() {
  return (
    <style>{`
      @page { margin: 16mm; }
      @media print {
        a[href]::after { content: ""; }
        .results-header__value { font-size: 28px; }
      }
    `}</style>
  );
}
