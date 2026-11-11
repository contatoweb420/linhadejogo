type FootballLoaderProps = {
  /** Describes the pending content to assistive technology. */
  label?: string;
};

/** Route fallback: its lifetime is owned entirely by React Suspense. */
export function FootballLoader({ label = "A carregar o jogo..." }: FootballLoaderProps) {
  return (
    <div className="ldj-loading" role="status" aria-live="polite" aria-atomic="true" aria-busy="true">
      <div className="ldj-loading__scene" aria-hidden="true">
        <svg className="ldj-loading__stadium" viewBox="0 0 720 360" fill="none" focusable="false">
          <use href="/loading-football.svg#stadium" />
          <g className="ldj-loading__net">
            <use href="/loading-football.svg#net" />
          </g>
          <ellipse className="ldj-loading__impact" cx="402" cy="120" rx="19" ry="13" />
          <g className="ldj-loading__shadow">
            <ellipse cx="0" cy="0" rx="23" ry="6" fill="#020b08" fillOpacity="0.55" />
          </g>
          <g className="ldj-loading__shot">
            <g className="ldj-loading__ball">
              <svg x="-22" y="-22" width="44" height="44" viewBox="0 0 100 100" overflow="visible">
                <use href="/loading-football.svg#ball" />
              </svg>
            </g>
          </g>
          <use href="/loading-football.svg#goal" />
        </svg>
      </div>
      <p className="ldj-loading__brand" aria-hidden="true">LINHA DE JOGO</p>
      <p className="ldj-loading__caption" aria-hidden="true">A carregar o jogo<span className="ldj-loading__dots">...</span></p>
      <span className="sr-only">{label}</span>
    </div>
  );
}
