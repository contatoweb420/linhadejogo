import { CountUp, GrowBar, LineChart, Reveal } from "@/components/chart-motion";
import { summarizeTeam, type TeamSampleMatch } from "@/server/stats/team";
import { translate, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";

const resultLabel = { V: "Win", E: "Draw", D: "Loss" } as const;

function resultOf(match: TeamSampleMatch) {
  if (match.goalsFor > match.goalsAgainst) return "V" as const;
  if (match.goalsFor < match.goalsAgainst) return "D" as const;
  return "E" as const;
}

function recent(matches: TeamSampleMatch[]) {
  return [...matches].sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()).slice(-10);
}

export async function MatchCharts({
  homeName,
  awayName,
  homeMatches,
  awayMatches,
}: {
  homeName: string;
  awayName: string;
  homeMatches: TeamSampleMatch[];
  awayMatches: TeamSampleMatch[];
}) {
  const locale: Locale = await getLocale();
  if (homeMatches.length === 0 && awayMatches.length === 0) {
    return (
      <section className="border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">{locale === "en-US" ? "Charts" : "Gráficos"}</h2>
        <p className="mt-2 text-sm">{locale === "en-US" ? "Unavailable. There are no previous games with official results to chart performance." : locale === "pt-BR" ? "Indisponível. Ainda não há partidas anteriores com resultado oficial para mostrar o desempenho." : "Não disponível. Ainda não há jogos anteriores com resultado regulamentar para apresentar o desempenho."}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl">{locale === "en-US" ? "Charts" : "Gráficos"}</h2>
      <p className="text-sm text-muted">
        {locale === "en-US" ? "Actual values from previous games in this league, from the live source and OpenFootball history when linked to the same team. These are not predictions." : locale === "pt-BR" ? "Dados reais de partidas anteriores neste campeonato, da fonte ao vivo e do histórico do OpenFootball quando vinculados ao mesmo time. Não são previsões." : "Valores reais dos jogos anteriores nesta competição, da origem em directo e do histórico OpenFootball quando associados à mesma equipa. Não são previsões."}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentChart name={homeName} matches={homeMatches} locale={locale} />
        <RecentChart name={awayName} matches={awayMatches} locale={locale} />
      </div>
      <ComparisonChart homeName={homeName} awayName={awayName} homeMatches={homeMatches} awayMatches={awayMatches} locale={locale} />
    </section>
  );
}

function RecentChart({ name, matches, locale }: { name: string; matches: TeamSampleMatch[]; locale: Locale }) {
  const t = (text: string) => translate(locale, text);
  const rows = recent(matches);
  if (rows.length === 0) {
    return (
      <section className="border border-line bg-card p-5">
        <h3 className="font-medium">{name}</h3>
        <p className="mt-2 text-sm">{locale === "en-US" ? "Unavailable. No previous games with official results." : locale === "pt-BR" ? "Indisponível. Não há partidas anteriores com resultado oficial." : "Não disponível. Sem jogos anteriores com resultado regulamentar."}</p>
      </section>
    );
  }
  const signature = rows.map((match) => `${match.utcDate}:${match.goalsFor}-${match.goalsAgainst}`).join("|");
  return (
    <Reveal>
      <section className="stat-card border border-line bg-card p-5">
        <h3 className="font-medium">{name}</h3>
        <p className="mt-1 text-sm text-muted">{locale === "en-US" ? `Last ${rows.length} games, oldest to newest. Blue: goals scored. Amber: goals allowed.` : locale === "pt-BR" ? `Últimas ${rows.length} partidas, da mais antiga à mais recente. Azul: gols marcados. Âmbar: gols sofridos.` : `Últimos ${rows.length} jogos, do mais antigo ao mais recente. Azul: golos marcados. Âmbar: golos sofridos.`}</p>
        <div className="mt-3">
          <LineChart
            label={locale === "en-US" ? `${name}: goals scored and allowed in the last ${rows.length} games` : locale === "pt-BR" ? `${name}: gols marcados e sofridos nas últimas ${rows.length} partidas` : `${name}: golos marcados e sofridos nos últimos ${rows.length} jogos`}
            signature={signature}
            points={rows.map((match) => ({
              date: match.utcDate,
              caption: `${t(resultLabel[resultOf(match)])}${match.venue === "home" ? (locale === "en-US" ? " at home" : locale === "pt-BR" ? " em casa" : " em casa") : (locale === "en-US" ? " away" : locale === "pt-BR" ? " fora" : " fora")}`,
            }))}
            series={[
              { name: t("Golos marcados"), tone: "primary", values: rows.map((match) => match.goalsFor) },
              { name: t("Golos sofridos"), tone: "warn", values: rows.map((match) => match.goalsAgainst) },
            ]}
          />
        </div>
      </section>
    </Reveal>
  );
}

function ComparisonChart({
  homeName,
  awayName,
  homeMatches,
  awayMatches,
  locale,
}: {
  homeName: string;
  awayName: string;
  homeMatches: TeamSampleMatch[];
  awayMatches: TeamSampleMatch[];
  locale: Locale;
}) {
  const t = (text: string) => translate(locale, text);
  const homeSummary = summarizeTeam(homeMatches);
  const awaySummary = summarizeTeam(awayMatches);
  const home = average(homeMatches);
  const away = average(awayMatches);
  const rows = [
    [t("Golos marcados por jogo"), home.count ? home.scored : null, away.count ? away.scored : null, false],
    [t("Golos sofridos por jogo"), home.count ? home.conceded : null, away.count ? away.conceded : null, false],
    [t("Pontos por jogo"), homeSummary.pointsPerGame, awaySummary.pointsPerGame, false],
    [t("Mais de 2,5 golos"), homeSummary.over25 == null ? null : homeSummary.over25 * 100, awaySummary.over25 == null ? null : awaySummary.over25 * 100, true],
  ] as const;

  return (
    <Reveal>
      <section className="stat-card border border-line bg-card p-5">
        <h3 className="font-medium">{t("Comparação na amostra")}</h3>
        <p className="mt-1 text-sm text-muted">
          {locale === "en-US" ? `${homeName}: ${home.count} games. ${awayName}: ${away.count} games. The blue bar is the home team and amber is the away team. Points per game and over 2.5 goals use the same sample of completed games.` : locale === "pt-BR" ? `${homeName}: ${home.count} partidas. ${awayName}: ${away.count} partidas. A barra azul representa o mandante e a âmbar, o visitante. Pontos por partida e mais de 2,5 gols usam a mesma amostra de partidas concluídas.` : `${homeName}: ${home.count} jogos. ${awayName}: ${away.count} jogos. A barra azul representa a equipa da casa e a âmbar a equipa visitante. Pontos por jogo e mais de 2,5 golos usam a mesma amostra de jogos disputados.`}
        </p>
        <div className="mt-4 space-y-4">
          {rows.map(([label, homeValue, awayValue, percent]) => {
            const max = percent ? 100 : Math.max(homeValue ?? 0, awayValue ?? 0, 1);
            return (
              <div key={label}>
                <p className="text-sm">{label}</p>
                <Bar label={homeName} value={homeValue} max={max} tone="primary" percent={percent} locale={locale} />
                <Bar label={awayName} value={awayValue} max={max} tone="warn" percent={percent} locale={locale} />
              </div>
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}

function average(matches: TeamSampleMatch[]) {
  if (matches.length === 0) return { count: 0, scored: 0, conceded: 0 };
  const scored = matches.reduce((sum, match) => sum + match.goalsFor, 0) / matches.length;
  const conceded = matches.reduce((sum, match) => sum + match.goalsAgainst, 0) / matches.length;
  return { count: matches.length, scored, conceded };
}

function Bar({
  label,
  value,
  max,
  tone,
  percent = false,
  locale,
}: {
  label: string;
  value: number | null;
  max: number;
  tone: "primary" | "warn";
  percent?: boolean;
  locale: Locale;
}) {
  const text = value == null
    ? translate(locale, "Não disponível")
    : percent
      ? `${value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
      : value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="mt-2 grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-2 text-sm">
      <span className="truncate">{label}</span>
      <GrowBar value={value ?? 0} max={max} tone={tone} tip={value == null ? `${label}: ${translate(locale, "Não disponível")}` : `${label}: ${text}`} />
      <span className="text-right">
        {value == null ? text : <CountUp value={value} kind={percent ? "pct" : "num"} />}
      </span>
    </div>
  );
}
