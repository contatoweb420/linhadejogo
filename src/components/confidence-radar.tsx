import { CountUp, Reveal } from "@/components/chart-motion";
import { readConfidence, type DataQuality, type Sharpness } from "@/server/model/confidence";
import type { ModelResult } from "@/server/model/poisson";
import { translate, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";

const dataLabel: Record<DataQuality, string> = {
  insuficiente: "Insuficiente",
  limitada: "Limitada",
  suficiente: "Suficiente",
};

const sharpnessLabel: Record<Sharpness, string> = {
  indisponivel: "Não disponível",
  apertada: "Apertada",
  moderada: "Moderada",
  separada: "Separada",
};

export async function ConfidenceRadar({ result }: { result: ModelResult }) {
  const locale = await getLocale();
  const t = (text: string) => translate(locale, text);
  const reading = readConfidence(result);

  return (
    <Reveal>
      <section className="stat-card border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">{locale === "en-US" ? "Confidence overview" : locale === "pt-BR" ? "Indicador de confiança" : "Radar de confiança"}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {locale === "en-US" ? "Data quality describes the sample used. Clarity is the gap between the highest and second-highest percentages. A clear favorite can still lose. Neither measure guarantees a result." : locale === "pt-BR" ? "A qualidade descreve a amostra usada. A clareza é a distância entre a maior e a segunda porcentagem. Mesmo uma previsão clara pode errar. Nenhuma das medidas garante o resultado." : "A qualidade descreve a amostra usada. A nitidez é a distância entre a percentagem maior e a segunda. Uma estimativa clara pode falhar. Nenhuma das medidas garante o resultado."}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border border-line bg-raised px-4 py-3">
            <dt className="text-sm text-muted">{locale === "en-US" ? "Data quality" : "Qualidade dos dados"}</dt>
            <dd className="mt-1 font-serif text-2xl">{t(dataLabel[reading.data])}</dd>
          </div>
          <div className="border border-line bg-raised px-4 py-3">
            <dt className="text-sm text-muted">{locale === "en-US" ? "Prediction clarity" : locale === "pt-BR" ? "Clareza da previsão" : "Nitidez da estimativa"}</dt>
            <dd className="mt-1 font-serif text-2xl">{t(sharpnessLabel[reading.sharpness])}</dd>
            <dd className="mt-1 text-sm text-muted">
              {reading.gapPoints == null ? (
                locale === "en-US" ? "Without percentages, there is no gap to measure." : "Sem percentagens, não há distância para medir."
              ) : (
                <>{locale === "en-US" ? "Gap:" : "Distância:"} <CountUp value={reading.gapPoints} kind="gap" /> {locale === "en-US" ? "percentage points." : "pontos percentuais."}</>
              )}
            </dd>
          </div>
        </dl>
        {reading.data === "suficiente" ? (
          <p className="mt-4 text-sm leading-6">
            {locale === "en-US" ? "The sample meets the thresholds of 80 league games, 15 games per team, and separate home and away rates." : locale === "pt-BR" ? "A amostra atinge os limites de 80 partidas do campeonato, 15 por time e taxas específicas de mandante e visitante." : "A amostra atinge os limiares de 80 jogos da liga, 15 por equipa e taxas próprias da casa e da visita."}
          </p>
        ) : (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm leading-6">
            {reading.dataReasons.map((reason) => <li key={reason}>{translateReason(reason, locale)}</li>)}
          </ul>
        )}
      </section>
    </Reveal>
  );
}

function translateReason(reason: string, locale: Locale) {
  if (locale === "pt-PT") return reason;
  const league = reason.match(/^A liga tem (\d+) jogos terminados antes deste encontro\. O modelo pede pelo menos (\d+)\.$/);
  if (league) return locale === "en-US"
    ? `The league has ${league[1]} completed games before this matchup. The model requires at least ${league[2]}.`
    : `O campeonato tem ${league[1]} partidas concluídas antes deste jogo. O modelo exige pelo menos ${league[2]}.`;
  const teams = reason.match(/^Amostra das equipas antes do jogo: casa (\d+), fora (\d+)\. O modelo pede pelo menos (\d+) para cada uma\.$/);
  if (teams) return locale === "en-US"
    ? `Team sample before the game: home ${teams[1]}, away ${teams[2]}. The model requires at least ${teams[3]} for each team.`
    : `Amostra dos times antes da partida: mandante ${teams[1]}, visitante ${teams[2]}. O modelo exige pelo menos ${teams[3]} para cada um.`;
  const simple: Record<string, Record<Locale, string>> = {
    "A taxa da casa foi agregada porque havia menos de 3 jogos em casa.": { "pt-BR": "A taxa do mandante foi agrupada porque havia menos de 3 partidas em casa.", "pt-PT": reason, "en-US": "The home rate was pooled because there were fewer than 3 home games." },
    "A taxa da visita foi agregada porque havia menos de 3 jogos fora.": { "pt-BR": "A taxa do visitante foi agrupada porque havia menos de 3 partidas fora de casa.", "pt-PT": reason, "en-US": "The away rate was pooled because there were fewer than 3 away games." },
    "A média de golos da liga é zero. O modelo não consegue estimar forças relativas.": { "pt-BR": "A média de gols do campeonato é zero. O modelo não consegue estimar as forças relativas.", "pt-PT": reason, "en-US": "The league's average goals are zero. The model can't estimate relative strength." },
    "A distribuição de resultados ficou sem massa. A previsão não foi calculada.": { "pt-BR": reason, "pt-PT": reason, "en-US": "The outcome distribution has no remaining mass. No prediction was calculated." },
  };
  return simple[reason]?.[locale] ?? reason;
}
