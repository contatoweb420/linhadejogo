export const TIME_ZONE = "Europe/Lisbon";

export function formatModelVersion(version: string) {
  if (version === "quadrante-poisson-v1") return "Linha de Jogo, versão 1";
  return "Linha de Jogo";
}

export function lisbonToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function currentTimestamp() {
  return Date.now();
}

export function addCalendarDays(day: string, days: number) {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + days));
  return shifted.toISOString().slice(0, 10);
}

export function lisbonDayBounds(day: string) {
  const start = zonedMidnightToUtc(day);
  const end = zonedMidnightToUtc(addCalendarDays(day, 1));
  return { start, end };
}

function zonedMidnightToUtc(day: string) {
  const utcGuess = new Date(`${day}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcGuess);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const zonedAsUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return new Date(utcGuess.getTime() - (zonedAsUtc - utcGuess.getTime()));
}

export function formatLisbonDate(value: Date | string) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatLisbonTime(value: Date | string) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatLisbonDateTime(value: Date | string) {
  return `${formatLisbonDate(value)}, ${formatLisbonTime(value)}`;
}

export function formatLisbonLongDate(day: string) {
  const noon = zonedMidnightToUtc(day);
  noon.setUTCHours(noon.getUTCHours() + 12);
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(noon);
}

const numberFormat = new Intl.NumberFormat("pt-PT", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const percentFormat = new Intl.NumberFormat("pt-PT", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "Não disponível";
  return numberFormat.format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "Não disponível";
  return percentFormat.format(value);
}

export function formatOneDecimalPercent(value: number) {
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value) + " %";
}

const COUNTRIES: Record<string, string> = {
  Portugal: "Portugal",
  England: "Inglaterra",
  Spain: "Espanha",
  Germany: "Alemanha",
  France: "França",
  Italy: "Itália",
  Netherlands: "Países Baixos",
  Brazil: "Brasil",
  Europe: "Europa",
  World: "Mundo",
  "South America": "América do Sul",
};

export function formatCountry(name: string | null | undefined) {
  if (!name) return "Não disponível";
  return COUNTRIES[name] ?? name;
}

const STATUS: Record<string, string> = {
  SCHEDULED: "Agendado",
  TIMED: "Marcado",
  IN_PLAY: "A decorrer",
  PAUSED: "Intervalo",
  FINISHED: "Terminado",
  SUSPENDED: "Suspenso",
  POSTPONED: "Adiado",
  CANCELLED: "Cancelado",
  AWARDED: "Atribuído",
};

export function formatStatus(status: string) {
  return STATUS[status] ?? status;
}

export function isLiveStatus(status: string) {
  return status === "IN_PLAY" || status === "PAUSED";
}

export function matchGroup(status: string) {
  if (isLiveStatus(status)) return "live" as const;
  if (status === "SCHEDULED" || status === "TIMED") return "upcoming" as const;
  if (status === "FINISHED") return "finished" as const;
  return "other" as const;
}

export function formatStage(stage: string | null) {
  if (!stage) return "Não disponível";
  const labels: Record<string, string> = {
    REGULAR_SEASON: "Época regular",
    GROUP_STAGE: "Fase de grupos",
    LAST_64: "Trinta e dois avos de final",
    LAST_32: "Dezasseis avos de final",
    LAST_16: "Oitavos de final",
    QUARTER_FINALS: "Quartos de final",
    SEMI_FINALS: "Meias-finais",
    FINAL: "Final",
    THIRD_PLACE: "Terceiro lugar",
    ROUND_1: "1.ª eliminatória",
    ROUND_2: "2.ª eliminatória",
    ROUND_3: "3.ª eliminatória",
    ROUND_4: "4.ª eliminatória",
    PRELIMINARY_ROUND: "Pré-eliminatória",
    QUALIFICATION: "Qualificação",
    QUALIFICATION_ROUND_1: "1.ª pré-eliminatória",
    QUALIFICATION_ROUND_2: "2.ª pré-eliminatória",
    QUALIFICATION_ROUND_3: "3.ª pré-eliminatória",
    PLAYOFF_ROUND_1: "1.ª mão da eliminatória",
    PLAYOFF_ROUND_2: "2.ª mão da eliminatória",
    PLAYOFFS: "Eliminatória",
    CHAMPIONSHIP_ROUND: "Fase de campeão",
    RELEGATION_ROUND: "Fase de despromoção",
    APERTURA: "Abertura",
    CLAUSURA: "Encerramento",
  };
  return labels[stage] ?? "Fase não disponível";
}

export function formatDuration(duration: string | null) {
  if (!duration) return "Não disponível";
  const labels: Record<string, string> = {
    REGULAR: "Tempo regulamentar",
    EXTRA_TIME: "Prolongamento",
    PENALTY_SHOOTOUT: "Desempate por penáltis",
  };
  return labels[duration] ?? "Não disponível";
}

export function formatWinner(winner: string | null) {
  if (!winner) return "Não disponível";
  const labels: Record<string, string> = {
    HOME_TEAM: "Equipa da casa",
    AWAY_TEAM: "Equipa visitante",
    DRAW: "Empate",
  };
  return labels[winner] ?? "Não disponível";
}

export function parseStandingForm(form: string | null | undefined): Array<"V" | "E" | "D"> {
  if (!form) return [];
  const marks: Array<"V" | "E" | "D"> = [];
  for (const char of form.toUpperCase()) {
    if (char === "W" || char === "V") marks.push("V");
    else if (char === "D" || char === "E") marks.push("E");
    else if (char === "L") marks.push("D");
  }
  return marks;
}

export function formatGroup(group: string | null) {
  if (!group) return "Não disponível";
  const match = /^GROUP_([A-Z])$/.exec(group);
  if (match) return `Grupo ${match[1]}`;
  return "Grupo não disponível";
}

export function formatPosition(position: string | null) {
  if (!position) return "Posição não disponível";
  const labels: Record<string, string> = {
    Goalkeeper: "Guarda-redes",
    Defence: "Defesa",
    Defender: "Defesa",
    "Centre-Back": "Defesa central",
    "Left-Back": "Lateral esquerdo",
    "Right-Back": "Lateral direito",
    Sweeper: "Líbero",
    Midfield: "Médio",
    Midfielder: "Médio",
    "Defensive Midfield": "Médio defensivo",
    "Central Midfield": "Médio centro",
    "Attacking Midfield": "Médio ofensivo",
    "Left Midfield": "Médio esquerdo",
    "Right Midfield": "Médio direito",
    Offence: "Avançado",
    Attacker: "Avançado",
    "Centre-Forward": "Avançado centro",
    "Left Winger": "Extremo esquerdo",
    "Right Winger": "Extremo direito",
    "Left Wing": "Extremo esquerdo",
    "Right Wing": "Extremo direito",
    "Second Striker": "Segundo avançado",
    "Secondary Striker": "Segundo avançado",
  };
  return labels[position] ?? "Posição não disponível";
}
