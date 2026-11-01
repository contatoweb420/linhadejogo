const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const EDGE_TOKENS = new Set(["fc", "cf", "ac", "afc", "sc", "bc", "ud", "cd", "ec", "club"]);

export function normalizeName(value) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function signature(value) {
  const parts = normalizeName(value).split(" ").filter(Boolean);
  while (parts.length > 1 && EDGE_TOKENS.has(parts[0])) parts.shift();
  while (parts.length > 1 && EDGE_TOKENS.has(parts[parts.length - 1])) parts.pop();
  return parts.join(" ");
}

export function zonedToUtc(date, time, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(guess);
  const read = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const zonedAsUtc = Date.UTC(Number(read.year), Number(read.month) - 1, Number(read.day), Number(read.hour), Number(read.minute), Number(read.second));
  return new Date(guess.getTime() - (zonedAsUtc - guess.getTime()));
}

export function resolveTeam(name, teams, aliases) {
  const aliasedName = aliases[signature(name)];
  if (aliasedName) {
    const exact = teams.filter((team) => team.name === aliasedName);
    if (exact.length === 1) return exact[0];
    return null;
  }
  const wanted = signature(name);
  const hits = teams.filter((team) => {
    const candidates = [team.name, team.shortName].filter((value) => value);
    return candidates.some((value) => signature(value) === wanted);
  });
  const ids = new Set(hits.map((team) => team.id));
  if (ids.size !== 1) return null;
  return hits[0];
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function valid(value) {
  return value == null || (value >= 0 && value <= 30);
}

function scoreFields(parsed) {
  const values = [
    parsed.homeGoals, parsed.awayGoals, parsed.htHome, parsed.htAway,
    parsed.etHome, parsed.etAway, parsed.penHome, parsed.penAway,
  ];
  if (values.some((value) => !valid(value))) return null;
  return parsed;
}

function parseScoreToken(token) {
  const penAet = /^(\d+)\s*-\s*(\d+)\s+pen\.\s+(\d+)\s*-\s*(\d+)\s+a\.e\.t\.(?:\s+\((\d+)\s*-\s*(\d+)\))?$/i.exec(token);
  if (penAet) {
    return {
      homeGoals: Number(penAet[3]),
      awayGoals: Number(penAet[4]),
      htHome: penAet[5] == null ? null : Number(penAet[5]),
      htAway: penAet[6] == null ? null : Number(penAet[6]),
      etHome: Number(penAet[3]),
      etAway: Number(penAet[4]),
      penHome: Number(penAet[1]),
      penAway: Number(penAet[2]),
      duration: "PENALTY_SHOOTOUT",
    };
  }
  const aetPairs = /^(\d+)\s*-\s*(\d+)\s+a\.e\.t\.\s+\((\d+)\s*-\s*(\d+)\s*,\s*(\d+)\s*-\s*(\d+)\)$/i.exec(token);
  if (aetPairs) {
    return {
      homeGoals: Number(aetPairs[3]),
      awayGoals: Number(aetPairs[4]),
      htHome: Number(aetPairs[5]),
      htAway: Number(aetPairs[6]),
      etHome: Number(aetPairs[1]),
      etAway: Number(aetPairs[2]),
      penHome: null,
      penAway: null,
      duration: "EXTRA_TIME",
    };
  }
  const aet = /^(\d+)\s*-\s*(\d+)\s+a\.e\.t\.(?:\s+\((\d+)\s*-\s*(\d+)\))?$/i.exec(token);
  if (aet) {
    return {
      homeGoals: aet[3] == null ? null : Number(aet[3]),
      awayGoals: aet[4] == null ? null : Number(aet[4]),
      htHome: null,
      htAway: null,
      etHome: Number(aet[1]),
      etAway: Number(aet[2]),
      penHome: null,
      penAway: null,
      duration: "EXTRA_TIME",
    };
  }
  const pen = /^(\d+)\s*-\s*(\d+)\s+pen\.(?:\s+\((\d+)\s*-\s*(\d+)\))?$/i.exec(token);
  if (pen) {
    return {
      homeGoals: pen[3] == null ? null : Number(pen[3]),
      awayGoals: pen[4] == null ? null : Number(pen[4]),
      htHome: null,
      htAway: null,
      etHome: null,
      etAway: null,
      penHome: Number(pen[1]),
      penAway: Number(pen[2]),
      duration: "PENALTY_SHOOTOUT",
    };
  }
  const regular = /^(\d+)\s*-\s*(\d+)(?:\s+\((\d+)\s*-\s*(\d+)\))?$/.exec(token);
  if (!regular) return null;
  return {
    homeGoals: Number(regular[1]),
    awayGoals: Number(regular[2]),
    htHome: regular[3] == null ? null : Number(regular[3]),
    htAway: regular[4] == null ? null : Number(regular[4]),
    etHome: null,
    etAway: null,
    penHome: null,
    penAway: null,
    duration: "REGULAR",
  };
}

function emptyScore(status) {
  return {
    homeGoals: null,
    awayGoals: null,
    htHome: null,
    htAway: null,
    etHome: null,
    etAway: null,
    penHome: null,
    penAway: null,
    duration: null,
    status,
  };
}

function parseMatchLine(body) {
  const postponed = /\b(postponed|cancelled|canceled)\b/i.test(body) || /\[(?:postponed|cancelled|canceled)\]/i.test(body);
  const cleaned = body.replace(/\s*\[(?:postponed|cancelled|canceled)\]/gi, "");
  if (/\b(awarded|w\.?o\.?)\b/i.test(cleaned)) return null;
  const versus = /\s+v(?:s\.?)?\s+/i.exec(cleaned);
  if (versus) {
    const home = cleaned.slice(0, versus.index).trim();
    const awayAndScore = cleaned.slice(versus.index + versus[0].length).trim();
    const scoreSplit = /^(.*?)(?:\s{2,}|\s+)(\d+\s*-\s*\d+.*)$/.exec(awayAndScore);
    const score = scoreSplit ? parseScoreToken(scoreSplit[2].trim()) : null;
    const away = (score ? scoreSplit[1] : awayAndScore).trim();
    if (!home || !away) return null;
    if (scoreSplit && !score) return null;
    return scoreFields({
      home,
      away,
      ...(score ?? emptyScore(postponed ? "POSTPONED" : "SCHEDULED")),
      status: score ? "FINISHED" : postponed ? "POSTPONED" : "SCHEDULED",
    });
  }
  const middle = /^(.*?)\s{2,}(\d+\s*-\s*\d+.*?)\s{2,}(\S.*?)$/.exec(cleaned);
  if (!middle) return null;
  const score = parseScoreToken(middle[2].trim());
  if (!score || !middle[1].trim() || !middle[3].trim()) return null;
  return scoreFields({
    home: middle[1].trim(),
    away: middle[3].trim(),
    ...score,
    status: "FINISHED",
  });
}

function fixtureStart(line) {
  const timed = /^(\d{1,2}:\d{2})\s+(.+)$/.exec(line);
  if (timed) return { time: timed[1], body: timed[2] };
  if (/\s+v(?:s\.?)?\s+/i.test(line) || /\s{2,}\d+\s*-\s*\d+/.test(line)) return { time: null, body: line };
  return null;
}

export function parseFootballTxt(text, fallback = {}) {
  const fixtures = [];
  let rejected = 0;
  let year = fallback.startYear ?? null;
  let lastMonth = null;
  let matchday = null;
  let currentDate = null;
  let currentTime = null;
  const header = /=\s+.+?\s+(\d{4})\s*\/\s*(\d{2,4})/.exec(text);
  const seasonStart = header ? Number(header[1]) : fallback.startYear ?? null;
  const seasonEnd = header ? Number(header[2].length === 2 ? `${String(header[1]).slice(0, 2)}${header[2]}` : header[2]) : fallback.endYear ?? null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("=")) continue;
    const day = /\bmatchday\s+(\d+)\b/i.exec(line) ?? /\b(?:round|jornada|leg)\s+(\d+)\b/i.exec(line);
    if (day && !/\d+\s*-\s*\d+/.test(line)) {
      matchday = Number(day[1]);
      continue;
    }
    const dated = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Za-z]{3})\s+(\d{1,2})(?:\s+(\d{4}))?\s*$/.exec(line);
    if (dated) {
      const month = MONTHS[dated[1].toLowerCase()];
      const dayNumber = Number(dated[2]);
      if (!month || dayNumber < 1 || dayNumber > 31) {
        rejected += 1;
        currentDate = null;
        continue;
      }
      if (dated[3]) year = Number(dated[3]);
      else if (year != null && lastMonth != null && month < lastMonth && lastMonth - month >= 6) year += 1;
      if (year == null) {
        rejected += 1;
        currentDate = null;
        continue;
      }
      lastMonth = month;
      currentDate = `${year}-${pad(month)}-${pad(dayNumber)}`;
      currentTime = null;
      continue;
    }
    const started = fixtureStart(line);
    if (!started) continue;
    if (!currentDate || (started.time == null && !currentTime)) {
      rejected += 1;
      continue;
    }
    if (started.time) {
      const [hour, minute] = started.time.split(":").map(Number);
      if (hour > 23 || minute > 59) {
        rejected += 1;
        continue;
      }
      currentTime = `${pad(hour)}:${pad(minute)}`;
    }
    const match = parseMatchLine(started.body);
    if (!match) {
      rejected += 1;
      continue;
    }
    fixtures.push({
      seasonStart,
      seasonEnd,
      matchday,
      date: currentDate,
      time: currentTime,
      ...match,
    });
  }

  return { fixtures, rejected, seasonStart, seasonEnd };
}
