import { translate, type Locale } from "./i18n";

const english: Record<string, string> = {
  Destaque: "Featured", Agendado: "Scheduled", Marcado: "Scheduled", "A decorrer": "In progress",
  Intervalo: "Half-time", Terminado: "Completed", Suspenso: "Suspended", Adiado: "Postponed",
  Cancelado: "Cancelled", Atribuído: "Awarded", Classificação: "Standings",
  Inglaterra: "England", Espanha: "Spain", Alemanha: "Germany", França: "France", Itália: "Italy",
  "Países Baixos": "Netherlands", Brasil: "Brazil", Europa: "Europe", Mundo: "World", "América do Sul": "South America",
  "Resultado regulamentar": "Regulation score", "Resultado final indicado pela origem": "Full-time score reported by source",
  "Prolongamento indicado pela origem": "Extra-time score reported by source", Penáltis: "Penalties",
  "Houve prolongamento": "Extra time was played", "Decidido nos penáltis": "Penalty shootout",
  "Quadro do dia, por competição": "Daily schedule by league", "Tabelas e calendário": "Standings and fixtures",
  "Pesquisa de clubes": "Club search", "Leitura das competições guardadas": "Saved league statistics",
  "Ficha do jogo e estimativa 1X2": "Match details and 1X2 prediction", "Só fontes autorizadas": "Authorized sources only",
  "Os estados apresentados são os guardados, incluindo jogos de datas anteriores ainda marcados como em direto.": "Saved statuses are shown, including games from earlier dates still marked as live.",
  "Ver jogos, incluindo adiados e cancelados": "View games, including postponed and cancelled matches",
  "Não há jogos em destaque guardados.": "No featured games are saved.",
};
const brazilian: Record<string, string> = {
  "Resultado regulamentar": "Placar no tempo regulamentar", "Resultado final indicado pela origem": "Placar final informado pela fonte",
  "Prolongamento indicado pela origem": "Prorrogação informada pela fonte", "Houve prolongamento": "Houve prorrogação",
  Penáltis: "Pênaltis", "Decidido nos penáltis": "Disputa de pênaltis",
  "Não há jogos em destaque guardados.": "Não há partidas em destaque salvas.",
};
export function homeText(locale: Locale, text: string) {
  return (locale === "en-US" ? english[text] : locale === "pt-BR" ? brazilian[text] : undefined)
    ?? translate(locale, text);
}
export function homeDateTime(value: Date | string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

type ResultFields = {
  regularHome: number | null; regularAway: number | null;
  duration?: string | null; ftHome?: number | null; ftAway?: number | null;
  etHome?: number | null; etAway?: number | null; penHome?: number | null; penAway?: number | null;
};
/** Display source fields separately. Never infer regulation scores or sum extra time. */
export function homeResultDetails(match: ResultFields, locale: Locale): string[] {
  const t = (text: string) => homeText(locale, text);
  const pair = (home: number | null | undefined, away: number | null | undefined) =>
    home != null && away != null ? `${home}–${away}` : t("Não disponível");
  const details = [`${t("Resultado regulamentar")}: ${pair(match.regularHome, match.regularAway)}`];
  if (match.duration === "EXTRA_TIME" || match.duration === "PENALTY_SHOOTOUT") {
    if (match.duration === "EXTRA_TIME") details.push(t("Houve prolongamento"));
    details.push(`${t("Resultado final indicado pela origem")}: ${pair(match.ftHome, match.ftAway)}`);
    if (match.duration === "EXTRA_TIME" || (match.etHome != null && match.etAway != null)) {
      details.push(`${t("Prolongamento indicado pela origem")}: ${pair(match.etHome, match.etAway)}`);
    }
  }
  if (match.duration === "PENALTY_SHOOTOUT" || (match.penHome != null && match.penAway != null)) {
    details.push(`${t("Penáltis")}: ${pair(match.penHome, match.penAway)}`);
  }
  return details;
}
