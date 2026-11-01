export const MODEL_VERSION = "quadrante-poisson-v1";
export const MODEL_LABEL = "Linha de Jogo, versão 1";
export const PRIOR_MATCHES = 6;
export const MIN_LEAGUE_MATCHES = 20;
export const MIN_TEAM_MATCHES = 5;
export const MIN_VENUE_MATCHES = 3;
/** Correção de Dixon-Coles. Constante de literatura, não estimada neste conjunto. */
export const RHO = -0.08;
export const MAX_GOALS = 8;
const LAMBDA_MIN = 0.2;
const LAMBDA_MAX = 4.5;

export type GoalMatch = {
  utcDate: string;
  homeTeamId: number;
  awayTeamId: number;
  homeGoals: number;
  awayGoals: number;
};

export type PredictRequest = {
  homeTeamId: number;
  awayTeamId: number;
  kickoff: string;
  history: GoalMatch[];
};

export type Scoreline = {
  home: number;
  away: number;
  probability: number;
};

export type Prediction = {
  version: typeof MODEL_VERSION;
  insufficient: false;
  lambdas: { home: number; away: number };
  probabilities: { home: number; draw: number; away: number };
  totals: {
    over15: number;
    under15: number;
    over25: number;
    under25: number;
    over35: number;
    under35: number;
  };
  btts: { yes: number; no: number };
  scorelines: Scoreline[];
  sample: {
    league: number;
    home: number;
    away: number;
    homeVenue: number;
    awayVenue: number;
    homePooled: boolean;
    awayPooled: boolean;
  };
  rates: {
    leagueHome: number;
    leagueAway: number;
    homeScored: number;
    homeConceded: number;
    awayScored: number;
    awayConceded: number;
  };
};

export type InsufficientPrediction = {
  version: typeof MODEL_VERSION;
  insufficient: true;
  reason: string;
  sample: { league: number; home: number; away: number };
};

export type ModelResult = Prediction | InsufficientPrediction;

function factorial(n: number) {
  let value = 1;
  for (let i = 2; i <= n; i += 1) value *= i;
  return value;
}

function poissonPmf(goals: number, lambda: number) {
  return (Math.exp(-lambda) * lambda ** goals) / factorial(goals);
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shrink(observed: number, count: number, priorMean: number) {
  return (count * observed + PRIOR_MATCHES * priorMean) / (count + PRIOR_MATCHES);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function beforeKickoff(history: GoalMatch[], kickoff: string) {
  const limit = new Date(kickoff).getTime();
  return history.filter((match) => new Date(match.utcDate).getTime() < limit);
}

function teamMatches(history: GoalMatch[], teamId: number) {
  return history.filter(
    (match) => match.homeTeamId === teamId || match.awayTeamId === teamId,
  );
}

function dixonColesTau(home: number, away: number, lambdaHome: number, lambdaAway: number) {
  if (home === 0 && away === 0) return 1 - lambdaHome * lambdaAway * RHO;
  if (home === 1 && away === 0) return 1 + lambdaAway * RHO;
  if (home === 0 && away === 1) return 1 + lambdaHome * RHO;
  if (home === 1 && away === 1) return 1 - RHO;
  return 1;
}

type SideRates = {
  attack: number;
  defense: number;
  scored: number;
  conceded: number;
  venueCount: number;
  pooled: boolean;
};

function sideRates(
  history: GoalMatch[],
  teamId: number,
  venue: "home" | "away",
  leagueHome: number,
  leagueAway: number,
): SideRates {
  const venueMatches = history.filter((match) =>
    venue === "home" ? match.homeTeamId === teamId : match.awayTeamId === teamId,
  );
  const scoredOf = (match: GoalMatch) =>
    match.homeTeamId === teamId ? match.homeGoals : match.awayGoals;
  const concededOf = (match: GoalMatch) =>
    match.homeTeamId === teamId ? match.awayGoals : match.homeGoals;

  if (venueMatches.length >= MIN_VENUE_MATCHES) {
    const scored = mean(venueMatches.map(scoredOf));
    const conceded = mean(venueMatches.map(concededOf));
    const attackBase = venue === "home" ? leagueHome : leagueAway;
    const defenseBase = venue === "home" ? leagueAway : leagueHome;
    return {
      attack: shrink(scored, venueMatches.length, attackBase) / attackBase,
      defense: shrink(conceded, venueMatches.length, defenseBase) / defenseBase,
      scored,
      conceded,
      venueCount: venueMatches.length,
      pooled: false,
    };
  }

  const all = teamMatches(history, teamId);
  const scored = mean(all.map(scoredOf));
  const conceded = mean(all.map(concededOf));
  const league = (leagueHome + leagueAway) / 2;
  return {
    attack: shrink(scored, all.length, league) / league,
    defense: shrink(conceded, all.length, league) / league,
    scored,
    conceded,
    venueCount: venueMatches.length,
    pooled: true,
  };
}

export function predictMatch(request: PredictRequest): ModelResult {
  const history = beforeKickoff(request.history, request.kickoff);
  const homeSample = teamMatches(history, request.homeTeamId).length;
  const awaySample = teamMatches(history, request.awayTeamId).length;
  const sample = { league: history.length, home: homeSample, away: awaySample };

  if (history.length < MIN_LEAGUE_MATCHES) {
    return {
      version: MODEL_VERSION,
      insufficient: true,
      reason: `A liga tem ${history.length} jogos terminados antes deste encontro. O modelo pede pelo menos ${MIN_LEAGUE_MATCHES}.`,
      sample,
    };
  }
  if (homeSample < MIN_TEAM_MATCHES || awaySample < MIN_TEAM_MATCHES) {
    return {
      version: MODEL_VERSION,
      insufficient: true,
      reason: `Amostra das equipas antes do jogo: casa ${homeSample}, fora ${awaySample}. O modelo pede pelo menos ${MIN_TEAM_MATCHES} para cada uma.`,
      sample,
    };
  }

  const leagueHome = mean(history.map((match) => match.homeGoals));
  const leagueAway = mean(history.map((match) => match.awayGoals));
  if (leagueHome <= 0 || leagueAway <= 0) {
    return {
      version: MODEL_VERSION,
      insufficient: true,
      reason: "A média de golos da liga é zero. O modelo não consegue estimar forças relativas.",
      sample,
    };
  }

  const home = sideRates(history, request.homeTeamId, "home", leagueHome, leagueAway);
  const away = sideRates(history, request.awayTeamId, "away", leagueHome, leagueAway);
  const lambdaHome = clamp(leagueHome * home.attack * away.defense, LAMBDA_MIN, LAMBDA_MAX);
  const lambdaAway = clamp(leagueAway * away.attack * home.defense, LAMBDA_MIN, LAMBDA_MAX);

  const grid: number[][] = [];
  for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals += 1) {
    grid[homeGoals] = [];
    for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals += 1) {
      const independent =
        poissonPmf(homeGoals, lambdaHome) * poissonPmf(awayGoals, lambdaAway);
      const tau = dixonColesTau(homeGoals, awayGoals, lambdaHome, lambdaAway);
      grid[homeGoals][awayGoals] = Math.max(0, independent * tau);
    }
  }

  const mass = grid.flat().reduce((sum, value) => sum + value, 0);
  if (mass <= 0) {
    return {
      version: MODEL_VERSION,
      insufficient: true,
      reason: "A distribuição de resultados ficou sem massa. A previsão não foi calculada.",
      sample,
    };
  }

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let btts = 0;
  const scorelines: Scoreline[] = [];

  for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals += 1) {
      const probability = grid[homeGoals][awayGoals] / mass;
      if (homeGoals > awayGoals) homeWin += probability;
      else if (homeGoals === awayGoals) draw += probability;
      else awayWin += probability;
      const total = homeGoals + awayGoals;
      if (total >= 2) over15 += probability;
      if (total >= 3) over25 += probability;
      if (total >= 4) over35 += probability;
      if (homeGoals > 0 && awayGoals > 0) btts += probability;
      scorelines.push({ home: homeGoals, away: awayGoals, probability });
    }
  }

  return {
    version: MODEL_VERSION,
    insufficient: false,
    lambdas: { home: lambdaHome, away: lambdaAway },
    probabilities: { home: homeWin, draw, away: awayWin },
    totals: {
      over15,
      under15: 1 - over15,
      over25,
      under25: 1 - over25,
      over35,
      under35: 1 - over35,
    },
    btts: { yes: btts, no: 1 - btts },
    scorelines: scorelines.sort((a, b) => b.probability - a.probability).slice(0, 5),
    sample: {
      league: history.length,
      home: homeSample,
      away: awaySample,
      homeVenue: home.venueCount,
      awayVenue: away.venueCount,
      homePooled: home.pooled,
      awayPooled: away.pooled,
    },
    rates: {
      leagueHome,
      leagueAway,
      homeScored: home.scored,
      homeConceded: home.conceded,
      awayScored: away.scored,
      awayConceded: away.conceded,
    },
  };
}

export function presentShares(values: number[], decimals = 1) {
  const scale = 10 ** decimals;
  const target = 100 * scale;
  const scaled = values.map((value) => value * target);
  const floors = scaled.map((value) => Math.floor(value));
  const remainder = target - floors.reduce((sum, value) => sum + value, 0);
  const order = scaled
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let step = 0; step < remainder; step += 1) {
    floors[order[step % order.length].index] += 1;
  }
  return floors.map((value) => value / scale);
}
