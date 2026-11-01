import { CountUp, LineChart } from "@/components/chart-motion";
import { formatLocaleNumber, formatLocalePercent, type Locale } from "@/lib/i18n";

export type AccuracyPoint = {
  date: string;
  match: string;
  score: string;
  predicted: string;
  actual: string;
  hit: boolean;
  probability: number;
  rate: number;
};

export function PredictionChart({ points, rate, locale }: { points: AccuracyPoint[]; rate: number; locale: Locale }) {
  const signature = points.map((point) => `${point.date}:${point.hit ? 1 : 0}`).join("|");
  return (
      <div className="mt-4">
        <p className="text-sm text-muted">
          {locale === "en-US" ? "Cumulative accuracy:" : "Acerto acumulado:"} <CountUp value={rate} kind="share" />. {locale === "en-US" ? "The line follows saved predictions from oldest to newest." : locale === "pt-BR" ? "A linha acompanha as previsões salvas, da mais antiga à mais recente." : "A linha segue as previsões guardadas, da mais antiga à mais recente."}
        </p>
        <div className="mt-3">
          <LineChart
            label={locale === "en-US" ? "Cumulative accuracy history for predictions saved before kickoff" : locale === "pt-BR" ? "Histórico de acerto acumulado das previsões registradas antes da partida" : "Histórico do acerto acumulado das previsões registadas antes do jogo"}
            signature={signature}
            points={points.map((point) => ({
              date: point.date,
              caption: `${point.match} ${point.score}. ${locale === "en-US" ? "Prediction" : "Previsão"}: ${point.predicted} (${formatLocalePercent(point.probability, locale)}). ${locale === "en-US" ? "Result" : "Resultado"}: ${point.actual}. ${point.hit ? (locale === "en-US" ? "Correct" : locale === "pt-BR" ? "Acertou" : "Acertou") : (locale === "en-US" ? "Incorrect" : locale === "pt-BR" ? "Errou" : "Falhou")}.`,
            }))}
            series={[
              {
                name: locale === "en-US" ? "Cumulative accuracy" : "Acerto acumulado",
                tone: "primary",
                values: points.map((point) => point.rate),
                digits: 1,
                suffix: " %",
              },
            ]}
          />
        </div>
        <p className="sr-only">{locale === "en-US" ? "Latest chart value:" : "Último valor da linha:"} {formatLocaleNumber(points[points.length - 1]?.rate ?? 0, locale, 1)}%.</p>
      </div>
  );
}
