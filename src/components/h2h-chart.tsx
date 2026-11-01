import { GrowBar, LineChart, Reveal } from "@/components/chart-motion";
import { formatNumber } from "@/server/format/pt";
import { translate, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";

export type H2HPoint = {
  date: string;
  competition: string;
  score: string;
  goalsHome: number;
  goalsAway: number;
};

export async function H2HChart({
  homeName,
  awayName,
  winsHome,
  draws,
  winsAway,
  points,
}: {
  homeName: string;
  awayName: string;
  winsHome: number;
  draws: number;
  winsAway: number;
  points: H2HPoint[];
}) {
  const locale: Locale = await getLocale();
  const t = (text: string) => translate(locale, text);
  const maxWins = Math.max(winsHome, draws, winsAway, 1);
  const rows = [
    { label: `${t("Vitórias de")} ${homeName}`, value: winsHome, tone: "primary" as const },
    { label: t("Empates"), value: draws, tone: "warn" as const },
    { label: `${t("Vitórias de")} ${awayName}`, value: winsAway, tone: "good" as const },
  ];
  const signature = points.map((point) => `${point.date}:${point.goalsHome}-${point.goalsAway}`).join("|");

  return (
    <Reveal>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-sm text-muted">{locale === "en-US" ? "Official results from these head-to-head games." : locale === "pt-BR" ? "Resultados oficiais desses confrontos diretos." : "Resultados regulamentares destes confrontos directos."}</p>
          <div className="mt-3 space-y-2">
            {rows.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{row.label}</span>
                  <span className="tabular">{formatNumber(row.value)}</span>
                </div>
                <GrowBar value={row.value} max={maxWins} tone={row.tone} tip={`${row.label}: ${formatNumber(row.value)}`} />
              </div>
            ))}
          </div>
        </div>
        {points.length > 0 ? (
          <div>
            <p className="text-sm text-muted">{locale === "en-US" ? `Goals in each game, oldest to newest. Blue: ${homeName}. Green: ${awayName}.` : locale === "pt-BR" ? `Gols em cada partida, da mais antiga à mais recente. Azul: ${homeName}. Verde: ${awayName}.` : `Golos em cada jogo, do mais antigo ao mais recente. Azul: ${homeName}. Verde: ${awayName}.`}</p>
            <div className="mt-3">
              <LineChart
                label={locale === "en-US" ? `Goals in head-to-head games between ${homeName} and ${awayName}` : locale === "pt-BR" ? `Gols nos confrontos diretos entre ${homeName} e ${awayName}` : `Golos dos confrontos directos entre ${homeName} e ${awayName}`}
                signature={signature}
                points={points.map((point) => ({
                  date: point.date,
                  caption: `${point.competition}. Marcador regulamentar ${point.score}.`,
                }))}
                series={[
                  { name: homeName, tone: "primary", values: points.map((point) => point.goalsHome) },
                  { name: awayName, tone: "good", values: points.map((point) => point.goalsAway) },
                ]}
              />
            </div>
          </div>
        ) : null}
      </div>
    </Reveal>
  );
}
