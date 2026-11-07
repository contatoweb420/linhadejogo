import { ProbabilityTiles } from "@/components/probability-tiles";
import { CountUp, GrowBar } from "@/components/chart-motion";
import { formatModelVersion, formatNumber, formatOneDecimalPercent } from "@/server/format/pt";
import { presentShares, type ModelResult } from "@/server/model/poisson";
import { translate, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";

export async function ProbabilityPanel({
  result,
  recordedAt,
  retrospective,
}: {
  result: ModelResult;
  recordedAt: Date | null;
  retrospective: boolean;
}) {
  const locale: Locale = await getLocale();
  const t = (text: string) => translate(locale, text);
  if (result.insufficient) {
    return (
      <section className="border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">{t("Probabilidades")}</h2>
        <p className="mt-2 text-sm leading-6">
          {t("Não disponível")}. {translatePredictionReason(result.reason, locale)} {locale === "en-US" ? "League games in sample:" : locale === "pt-BR" ? "Partidas do campeonato na amostra:" : "Jogos da liga na amostra:"} {result.sample.league}. {locale === "en-US" ? "Home:" : locale === "pt-BR" ? "Mandante:" : "Casa:"} {result.sample.home}. {locale === "en-US" ? "Away:" : locale === "pt-BR" ? "Visitante:" : "Fora:"} {result.sample.away}.
        </p>
      </section>
    );
  }

  const [home, draw, away] = presentShares([
    result.probabilities.home,
    result.probabilities.draw,
    result.probabilities.away,
  ]);

  return (
    <section className="stat-card border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">{locale === "en-US" ? "Win, tie, or loss probabilities" : locale === "pt-BR" ? "Probabilidades de vitória, empate ou derrota" : "Probabilidades de vitória, empate ou derrota"}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        {locale === "en-US" ? `Model estimate ${formatModelVersion(result.version)}, based on previous games in the same league. Home win, tie, and away win add up to 100%. This is not a guaranteed result.` : locale === "pt-BR" ? `Previsão do modelo ${formatModelVersion(result.version)}, baseada em partidas anteriores do mesmo campeonato. Vitória do mandante, empate e vitória do visitante somam 100%. O resultado não é garantido.` : `Estimativa do modelo ${formatModelVersion(result.version)}, baseada nos jogos anteriores da mesma competição. Vitória da equipa da casa, empate e vitória da equipa visitante somam 100%. O resultado não é garantido.`}
        {retrospective
          ? (locale === "en-US" ? " This calculation is retrospective; it was not recorded before the game." : locale === "pt-BR" ? " Este cálculo é retrospectivo e não foi registrado antes da partida." : " Este cálculo é retrospectivo e não foi registado antes do jogo.")
          : recordedAt
            ? ` ${locale === "en-US" ? "Saved on" : locale === "pt-BR" ? "Registro salvo em" : "Registo guardado em"} ${recordedAt.toLocaleString(locale, { timeZone: "Europe/Lisbon" })}.`
            : ""}
      </p>
      <ProbabilityTiles shares={{ home, draw, away }} locale={locale} />
      <h3 className="mt-6 font-medium">{locale === "en-US" ? "Model-estimated average goals" : locale === "pt-BR" ? "Média de gols estimada pelo modelo" : "Média de golos estimada pelo modelo"}</h3>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        <Metric label={locale === "en-US" ? "Home" : locale === "pt-BR" ? "Mandante" : "Casa"} value={result.lambdas.home} />
        <Metric label={locale === "en-US" ? "Away" : locale === "pt-BR" ? "Visitante" : "Visita"} value={result.lambdas.away} />
        <Metric label={locale === "en-US" ? "Total" : "Total"} value={result.lambdas.home + result.lambdas.away} />
      </dl>
      <h3 className="mt-6 font-medium">{locale === "en-US" ? "Most likely exact scores" : locale === "pt-BR" ? "Placar exato mais provável" : "Resultados exactos mais prováveis"}</h3>
      <p className="text-sm text-muted">{locale === "en-US" ? "Distribution estimates, capped at 8 goals per team." : locale === "pt-BR" ? "Previsões da distribuição, limitadas a 8 gols por time." : "Estimativas da distribuição, limitadas a 8 golos por equipa."}</p>
      <ul className="mt-2 space-y-2 text-sm">
        {result.scorelines.map((line) => {
          const percent = line.probability * 100;
          return (
            <li key={`${line.home}-${line.away}`}>
              <div className="mb-1 flex justify-between">
                <span className="tabular">{line.home}–{line.away}</span>
                <CountUp value={percent} kind="pct" />
              </div>
              <GrowBar
                value={percent}
                max={Math.max(...result.scorelines.map((item) => item.probability * 100), 1)}
                tone="primary"
                tip={`${line.home}–${line.away}: ${formatOneDecimalPercent(percent)}`}
              />
            </li>
          );
        })}
      </ul>
      <h3 className="mt-6 font-medium">{locale === "en-US" ? "Totals and both teams to score" : locale === "pt-BR" ? "Totais e ambas marcam" : "Totais e ambas marcam"}</h3>
      <Totals result={result} locale={locale} />
      <h3 className="mt-6 font-medium">{locale === "en-US" ? "What went into the calculation" : locale === "pt-BR" ? "O que entrou no cálculo" : "O que entrou no cálculo"}</h3>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">
        <li>
          {locale === "en-US" ? "League sample:" : locale === "pt-BR" ? "Amostra do campeonato:" : "Amostra da liga:"} {result.sample.league} {locale === "en-US" ? "completed games before kickoff. Average of" : locale === "pt-BR" ? "partidas concluídas antes do início. Média de" : "jogos terminados antes do apito inicial. Média de"} {formatNumber(result.rates.leagueHome)} {locale === "en-US" ? "home goals and" : locale === "pt-BR" ? "gols do mandante e" : "golos da casa e"} {formatNumber(result.rates.leagueAway)} {locale === "en-US" ? "away goals." : locale === "pt-BR" ? "gols do visitante." : "golos da visita."}
        </li>
        <li>
          {locale === "en-US" ? "Home:" : locale === "pt-BR" ? "Mandante:" : "Casa:"} {result.sample.home} {locale === "en-US" ? "games, including" : locale === "pt-BR" ? "partidas, sendo" : "jogos, dos quais"} {result.sample.homeVenue} {locale === "en-US" ? "at home." : locale === "pt-BR" ? "em casa." : "em casa."}
          {result.sample.homePooled
            ? (locale === "en-US" ? " Fewer than 3 home games were available, so the rate was pooled." : locale === "pt-BR" ? " Havia menos de 3 partidas em casa, então a taxa foi agrupada." : " Havia menos de 3 jogos em casa, por isso a taxa foi agregada.")
            : (locale === "en-US" ? ` Scored ${formatNumber(result.rates.homeScored)} and allowed ${formatNumber(result.rates.homeConceded)} per home game.` : locale === "pt-BR" ? ` Marcou ${formatNumber(result.rates.homeScored)} e sofreu ${formatNumber(result.rates.homeConceded)} gols por partida em casa.` : ` Marcou ${formatNumber(result.rates.homeScored)} e sofreu ${formatNumber(result.rates.homeConceded)} por jogo em casa.`)}
        </li>
        <li>
          {locale === "en-US" ? "Away:" : locale === "pt-BR" ? "Visitante:" : "Visita:"} {result.sample.away} {locale === "en-US" ? "games, including" : locale === "pt-BR" ? "partidas, sendo" : "jogos, dos quais"} {result.sample.awayVenue} {locale === "en-US" ? "away." : locale === "pt-BR" ? "fora de casa." : "fora."}
          {result.sample.awayPooled
            ? (locale === "en-US" ? " Fewer than 3 away games were available, so the rate was pooled." : locale === "pt-BR" ? " Havia menos de 3 partidas fora de casa, então a taxa foi agrupada." : " Havia menos de 3 jogos fora, por isso a taxa foi agregada.")
            : (locale === "en-US" ? ` Scored ${formatNumber(result.rates.awayScored)} and allowed ${formatNumber(result.rates.awayConceded)} per away game.` : locale === "pt-BR" ? ` Marcou ${formatNumber(result.rates.awayScored)} e sofreu ${formatNumber(result.rates.awayConceded)} gols por partida fora de casa.` : ` Marcou ${formatNumber(result.rates.awayScored)} e sofreu ${formatNumber(result.rates.awayConceded)} por jogo fora.`)}
        </li>
        <li>{locale === "en-US" ? "Each rate is shrunk toward the league average using a 6-game prior." : locale === "pt-BR" ? "Cada taxa é ajustada em direção à média do campeonato, com uma prior de 6 partidas." : "Cada taxa é reduzida em direcção à média da liga, com um prior de 6 jogos."}</li>
        <li>{locale === "en-US" ? "The low-score correction uses a fixed −0.08 parameter. It was not estimated from this sample." : locale === "pt-BR" ? "A correção de placares baixos usa o parâmetro fixo −0,08. Ele não foi estimado nesta amostra." : "A correcção dos resultados baixos usa um parâmetro fixo de −0,08. Não foi estimado nesta amostra."}</li>
        <li>{locale === "en-US" ? "Recent form and head-to-head history are shown separately and do not change these percentages." : locale === "pt-BR" ? "A forma recente e o histórico de confrontos diretos são mostrados à parte e não alteram estas porcentagens." : "A forma recente e os confrontos directos são apresentados à parte e não alteram estas percentagens."}</li>
        <li>{locale === "en-US" ? "Injuries, expected goals, market values, and individual player quality are not included. This source does not provide that data." : locale === "pt-BR" ? "Lesões, gols esperados, valores de mercado e qualidade individual dos jogadores não entram no cálculo. Essa fonte não fornece esses dados." : "Lesões, golos esperados, valores de mercado e qualidade individual dos jogadores não entram no cálculo. Esta fonte não disponibiliza esses dados."}</li>
      </ul>
    </section>
  );
}

function Totals({ result, locale }: { result: Extract<ModelResult, { insufficient: false }>; locale: Locale }) {
  const t = (text: string) => translate(locale, text);
  const [over15, under15] = presentShares([result.totals.over15, result.totals.under15]);
  const [over25, under25] = presentShares([result.totals.over25, result.totals.under25]);
  const [over35, under35] = presentShares([result.totals.over35, result.totals.under35]);
  const [bttsYes, bttsNo] = presentShares([result.btts.yes, result.btts.no]);
  const lines = [
    [t("Mais de 1,5"), over15],
    [t("Menos de 1,5"), under15],
    [t("Mais de 2,5"), over25],
    [t("Menos de 2,5"), under25],
    [t("Mais de 3,5"), over35],
    [t("Menos de 3,5"), under35],
    [t("Ambas marcam"), bttsYes],
    [t("Pelo menos uma não marca"), bttsNo],
  ] as const;
  return (
    <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
      {lines.map(([label, value]) => (
        <li key={label}>
          <div className="mb-1 flex justify-between gap-3">
            <span>{label}</span>
            <CountUp value={value} kind="pct" />
          </div>
          <GrowBar value={value} max={100} tone="primary" tip={`${label}: ${formatOneDecimalPercent(value)}`} />
        </li>
      ))}
    </ul>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-raised px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-lg">
        <CountUp value={value} kind="num" />
      </dd>
    </div>
  );
}

function translatePredictionReason(reason: string, locale: Locale) {
  const league = reason.match(/^A liga tem (\d+) jogos terminados antes deste encontro\. O modelo pede pelo menos (\d+)\.$/);
  if (league) return locale === "en-US"
    ? `The league has ${league[1]} completed games before this matchup. The model requires at least ${league[2]}.`
    : locale === "pt-BR"
      ? `O campeonato tem ${league[1]} partidas concluídas antes deste jogo. O modelo exige pelo menos ${league[2]}.`
      : reason;
  const teams = reason.match(/^Amostra das equipas antes do jogo: casa (\d+), fora (\d+)\. O modelo pede pelo menos (\d+) para cada uma\.$/);
  if (teams) return locale === "en-US"
    ? `Team sample before the game: home ${teams[1]}, away ${teams[2]}. The model requires at least ${teams[3]} for each team.`
    : locale === "pt-BR"
      ? `Amostra dos times antes da partida: mandante ${teams[1]}, visitante ${teams[2]}. O modelo exige pelo menos ${teams[3]} para cada um.`
      : reason;
  if (reason.includes("média de golos da liga é zero")) return locale === "en-US"
    ? "The league's average goals are zero. The model can't estimate relative strength."
    : locale === "pt-BR"
      ? "A média de gols do campeonato é zero. O modelo não consegue estimar as forças relativas."
      : reason;
  if (reason.includes("distribuição de resultados ficou sem massa")) return locale === "en-US"
    ? "The outcome distribution has no remaining mass. No prediction was calculated."
    : reason;
  return reason;
}
