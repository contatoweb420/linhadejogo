import type { Locale } from "@/lib/i18n";
import type { ShareEstimate } from "@/server/estimates";

/** Shares are already rounded by the original model's presentShares helper. */
export function ProbabilityTiles({ shares, locale }: { shares: ShareEstimate; locale: Locale }) {
  const labels = locale === "en-US"
    ? ["Home win", "Draw", "Away win"]
    : ["Vitória casa", "Empate", "Vitória visitante"];
  const formatter = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <dl className="probability-tiles" aria-label={locale === "en-US" ? "1X2 probabilities" : "Probabilidades 1X2"}>
      {(["home", "draw", "away"] as const).map((outcome, index) => (
        <div className="probability-tiles__tile" data-outcome={outcome} key={outcome}>
          <dt>{labels[index]}</dt>
          <dd>{formatter.format(shares[outcome])}<span>%</span></dd>
        </div>
      ))}
    </dl>
  );
}
