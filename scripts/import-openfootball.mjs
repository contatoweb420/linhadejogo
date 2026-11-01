import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { parseFootballTxt, resolveTeam, signature, zonedToUtc } from "./football-txt.mjs";

const SOURCE = "openfootball";
const LIVE = "football-data.org";

const ALIASES = {
  [signature("Benfica")]: "Sport Lisboa e Benfica",
  [signature("SL Benfica")]: "Sport Lisboa e Benfica",
  [signature("Vitória Guimarães")]: "Vitória SC",
  [signature("Vitória de Guimarães")]: "Vitória SC",
  [signature("Vitória Sport Clube")]: "Vitória SC",
  [signature("Sporting CP")]: "Sporting Clube de Portugal",
  [signature("Sporting Lisbon")]: "Sporting Clube de Portugal",
  [signature("Sporting Lisboa")]: "Sporting Clube de Portugal",
  [signature("Sporting Braga")]: "Sporting Clube de Braga",
  [signature("Sp. Braga")]: "Sporting Clube de Braga",
  [signature("Manchester Utd")]: "Manchester United FC",
  [signature("Man Utd")]: "Manchester United FC",
  [signature("Man United")]: "Manchester United FC",
  [signature("Man City")]: "Manchester City FC",
  [signature("Wolves")]: "Wolverhampton Wanderers FC",
  [signature("Spurs")]: "Tottenham Hotspur FC",
  [signature("Nott'm Forest")]: "Nottingham Forest FC",
  [signature("Atlético Madrid")]: "Club Atlético de Madrid",
  [signature("Atlético de Madrid")]: "Club Atlético de Madrid",
  [signature("Athletic Bilbao")]: "Athletic Club",
  [signature("Celta Vigo")]: "RC Celta de Vigo",
  [signature("Celta de Vigo")]: "RC Celta de Vigo",
  [signature("Deportivo La Coruña")]: "RC Deportivo La Coruña",
  [signature("Deportivo Coruña")]: "RC Deportivo La Coruña",
  [signature("Real Sociedad")]: "Real Sociedad de Fútbol",
  [signature("Bayern Munich")]: "FC Bayern München",
  [signature("Bayern München")]: "FC Bayern München",
  [signature("Bayern")]: "FC Bayern München",
  [signature("Mönchengladbach")]: "Borussia Mönchengladbach",
  [signature("Borussia Mönchengladbach")]: "Borussia Mönchengladbach",
  [signature("Gladbach")]: "Borussia Mönchengladbach",
  [signature("Köln")]: "1. FC Köln",
  [signature("FC Köln")]: "1. FC Köln",
  [signature("Inter Milan")]: "FC Internazionale Milano",
  [signature("Internazionale")]: "FC Internazionale Milano",
  [signature("Paris Saint-Germain")]: "Paris Saint-Germain FC",
  [signature("Paris SG")]: "Paris Saint-Germain FC",
  [signature("PSG")]: "Paris Saint-Germain FC",
  [signature("Marseille")]: "Olympique de Marseille",
  [signature("Olympique Marseille")]: "Olympique de Marseille",
  [signature("Lyon")]: "Olympique Lyonnais",
  [signature("Olympique Lyon")]: "Olympique Lyonnais",
  [signature("Lens")]: "Racing Club de Lens",
  [signature("Rennes")]: "Stade Rennais FC 1901",
  [signature("Stade Rennais")]: "Stade Rennais FC 1901",
  [signature("PSV Eindhoven")]: "PSV",
  [signature("AZ Alkmaar")]: "AZ",
  [signature("Ajax")]: "AFC Ajax",
  [signature("Feyenoord")]: "Feyenoord Rotterdam",
  [signature("GD Estoril")]: "GD Estoril Praia",
  [signature("Estoril")]: "GD Estoril Praia",
  [signature("NEC Nijmegen")]: "NEC",
  [signature("1899 Hoffenheim")]: "TSG 1899 Hoffenheim",
  [signature("Werder Bremen")]: "SV Werder Bremen",
  [signature("Bayer Leverkusen")]: "Bayer 04 Leverkusen",
  [signature("Bor. Mönchengladbach")]: "Borussia Mönchengladbach",
  [signature("RC Celta")]: "RC Celta de Vigo",
  [signature("Espanyol Barcelona")]: "RCD Espanyol de Barcelona",
  [signature("Lazio Roma")]: "SS Lazio",
  [signature("Sassuolo Calcio")]: "US Sassuolo Calcio",
};

const FEEDS = [
  { code: "PPL", repo: "europe", zone: "Europe/Lisbon", test: (file) => /portugal[/\\]\d{4}-\d{2}_pt1\.txt$/i.test(file) },
  { code: "DED", repo: "europe", zone: "Europe/Amsterdam", test: (file) => /netherlands[/\\]\d{4}-\d{2}_nl1\.txt$/i.test(file) },
  { code: "FL1", repo: "europe", zone: "Europe/Paris", test: (file) => /france[/\\]\d{4}-\d{2}_(?:fr1|ligue1|l1)\.txt$/i.test(file) },
  { code: "PL", repo: "england", zone: "Europe/London", test: (file) => /1-premierleague\.txt$/i.test(file) },
  { code: "ELC", repo: "england", zone: "Europe/London", test: (file) => /championship\.txt$/i.test(file) },
  { code: "BL1", repo: "deutschland", zone: "Europe/Berlin", test: (file) => /1-bundesliga\.txt$/i.test(file) },
  { code: "PD", repo: "espana", zone: "Europe/Madrid", test: (file) => /(?:^|[/\\])1-liga\.txt$/i.test(file) },
  { code: "SA", repo: "italy", zone: "Europe/Rome", test: (file) => /1-seriea\.txt$/i.test(file) },
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL em falta.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const report = {
  imported: 0,
  updated: 0,
  ignored: 0,
  rejected: 0,
  files: 0,
  unlinked: new Map(),
};

function seasonEndYear(start, twoDigits) {
  const century = Math.floor(start / 100) * 100;
  const end = century + twoDigits;
  return end > start ? end : end + 100;
}

function yearsFromPath(file) {
  const match = /(\d{4})-(\d{2})/.exec(file);
  if (!match) return {};
  const startYear = Number(match[1]);
  return { startYear, endYear: seasonEndYear(startYear, Number(match[2])) };
}

async function walk(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, files);
    else if (entry.name.endsWith(".txt")) files.push(full);
  }
  return files;
}

async function download(repo) {
  const root = path.resolve(".cache/openfootball");
  const destination = path.join(root, repo);
  await mkdir(root, { recursive: true });
  const response = await fetch(`https://codeload.github.com/openfootball/${repo}/zip/refs/heads/master`);
  if (!response.ok) throw new Error(`${repo} respondeu ${response.status}`);
  const zip = path.join(root, `${repo}.zip`);
  await writeFile(zip, Buffer.from(await response.arrayBuffer()));
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await new Promise((resolve, reject) => {
    const child = spawn("tar", ["-xf", zip, "-C", destination], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`tar ${repo} ${code}`))));
  });
  return walk(destination);
}

async function ensureSchema() {
  await sql.unsafe(`
    alter table teams add column if not exists provider_key text;
    alter table seasons add column if not exists provider_key text;
    alter table matches add column if not exists provider_key text;
    create unique index if not exists teams_source_provider_key on teams (source, provider_key) where provider_key is not null;
    create unique index if not exists seasons_source_provider_key on seasons (source, provider_key) where provider_key is not null;
    create unique index if not exists matches_source_provider_key on matches (source, provider_key) where provider_key is not null;
    create sequence if not exists archive_external_id_seq start with 900000001;
  `);
}

async function canonicalTeams() {
  return sql`
    select id, name, short_name as "shortName"
    from teams
    where source = ${LIVE}
  `;
}

async function liveDays(code, zone) {
  const rows = await sql`
    select m.home_team_id as home, m.away_team_id as away,
           to_char(m.utc_date at time zone ${zone}, 'YYYY-MM-DD') as day
    from matches m
    join competitions c on c.id = m.competition_id
    where m.source = ${LIVE} and c.code = ${code} and c.source = ${LIVE}
  `;
  return new Set(rows.map((row) => `${row.home}:${row.away}:${row.day}`));
}

async function teamId(name, code, teams) {
  const linked = resolveTeam(name, teams, ALIASES);
  if (linked) return { id: linked.id, linked: true };
  const key = `${SOURCE}:${code}:${signature(name)}`;
  const [found] = await sql`select id from teams where source = ${SOURCE} and provider_key = ${key}`;
  if (found) return { id: found.id, linked: false };
  const [created] = await sql`
    insert into teams (source, external_id, name, provider_key, fetched_at)
    values (${SOURCE}, nextval('archive_external_id_seq'), ${name}, ${key}, now())
    returning id
  `;
  const bucket = report.unlinked.get(code) ?? new Map();
  bucket.set(name, (bucket.get(name) ?? 0) + 1);
  report.unlinked.set(code, bucket);
  return { id: created.id, linked: false };
}

async function seasonId(competitionId, code, start, end, firstDate, lastDate) {
  const key = `${SOURCE}:${code}:${start ?? "na"}`;
  const [found] = await sql`select id from seasons where source = ${SOURCE} and provider_key = ${key}`;
  if (found) return found.id;
  const [created] = await sql`
    insert into seasons (competition_id, source, external_id, start_date, end_date, provider_key, fetched_at)
    values (
      ${competitionId}, ${SOURCE}, nextval('archive_external_id_seq'),
      ${firstDate}, ${lastDate}, ${key}, now()
    )
    returning id
  `;
  return created.id;
}

function winner(home, away) {
  if (home == null || away == null) return null;
  if (home > away) return "HOME_TEAM";
  if (home < away) return "AWAY_TEAM";
  return "DRAW";
}

async function saveMatch(row) {
  const [existing] = await sql`select id from matches where source = ${SOURCE} and provider_key = ${row.key}`;
  if (row.duplicate) {
    if (existing) await sql`delete from matches where id = ${existing.id}`;
    report.ignored += 1;
    return;
  }
  const [sameDay] = await sql`
    select id from matches
    where source = ${SOURCE}
      and competition_id = ${row.competitionId}
      and home_team_id = ${row.homeId}
      and away_team_id = ${row.awayId}
      and to_char(utc_date at time zone ${row.zone}, 'YYYY-MM-DD') = ${row.date}
      and provider_key is distinct from ${row.key}
    limit 1
  `;
  if (sameDay) {
    if (existing) await sql`delete from matches where id = ${existing.id}`;
    report.ignored += 1;
    return;
  }
  if (existing) {
    await sql`
      update matches set
        competition_id = ${row.competitionId},
        season_id = ${row.seasonId},
        utc_date = ${row.utcDate},
        status = ${row.status},
        matchday = ${row.matchday},
        duration = ${row.duration},
        home_team_id = ${row.homeId},
        away_team_id = ${row.awayId},
        ht_home = ${row.htHome},
        ht_away = ${row.htAway},
        regular_home = ${row.regularHome},
        regular_away = ${row.regularAway},
        ft_home = ${row.ftHome},
        ft_away = ${row.ftAway},
        et_home = ${row.etHome},
        et_away = ${row.etAway},
        pen_home = ${row.penHome},
        pen_away = ${row.penAway},
        winner = ${row.winner},
        fetched_at = now()
      where id = ${existing.id}
    `;
    report.updated += 1;
    return;
  }
  await sql`
    insert into matches (
      source, external_id, provider_key, competition_id, season_id, utc_date, status, matchday, duration,
      home_team_id, away_team_id, ht_home, ht_away, regular_home, regular_away, ft_home, ft_away,
      et_home, et_away, pen_home, pen_away, winner, fetched_at
    ) values (
      ${SOURCE}, nextval('archive_external_id_seq'), ${row.key}, ${row.competitionId}, ${row.seasonId},
      ${row.utcDate}, ${row.status}, ${row.matchday}, ${row.duration}, ${row.homeId}, ${row.awayId},
      ${row.htHome}, ${row.htAway}, ${row.regularHome}, ${row.regularAway}, ${row.ftHome}, ${row.ftAway},
      ${row.etHome}, ${row.etAway}, ${row.penHome}, ${row.penAway},
      ${row.winner}, now()
    )
  `;
  report.imported += 1;
}

async function importFeed(feed, files) {
  const chosen = files.filter((file) => feed.test(file));
  if (chosen.length === 0) {
    console.log(`${feed.code}: nenhum ficheiro correspondente em ${feed.repo}`);
    const sample = files.filter((file) => /liga|premier|serie|bundes|ligue|championship/i.test(file)).slice(0, 8);
    for (const file of sample) console.log(`  ${file}`);
    return;
  }
  const [competition] = await sql`
    select id from competitions where source = ${LIVE} and code = ${feed.code} limit 1
  `;
  if (!competition) {
    console.log(`${feed.code}: competição em falta na base`);
    return;
  }
  const teams = await canonicalTeams();
  const days = await liveDays(feed.code, feed.zone);
  const teamCache = new Map();
  for (const file of chosen.sort()) {
    const text = await readFile(file, "utf8");
    const parsed = parseFootballTxt(text, yearsFromPath(file));
    report.rejected += parsed.rejected;
    report.files += 1;
    if (parsed.fixtures.length === 0) continue;
    const dates = parsed.fixtures.map((fixture) => fixture.date).sort();
    const season = await seasonId(
      competition.id,
      feed.code,
      parsed.seasonStart,
      parsed.seasonEnd,
      dates[0],
      dates[dates.length - 1],
    );
    for (const fixture of parsed.fixtures) {
      const homeKey = `${feed.code}:${signature(fixture.home)}`;
      const awayKey = `${feed.code}:${signature(fixture.away)}`;
      if (!teamCache.has(homeKey)) teamCache.set(homeKey, await teamId(fixture.home, feed.code, teams));
      if (!teamCache.has(awayKey)) teamCache.set(awayKey, await teamId(fixture.away, feed.code, teams));
      const home = teamCache.get(homeKey);
      const away = teamCache.get(awayKey);
      const finished = fixture.homeGoals != null && fixture.awayGoals != null;
      const key = `${SOURCE}:${feed.code}:${fixture.date}:${signature(fixture.home)}:${signature(fixture.away)}`;
      await saveMatch({
        key,
        duplicate: home.linked && away.linked && days.has(`${home.id}:${away.id}:${fixture.date}`),
        competitionId: competition.id,
        seasonId: season,
        utcDate: zonedToUtc(fixture.date, fixture.time, feed.zone),
        zone: feed.zone,
        date: fixture.date,
        status: fixture.status,
        matchday: fixture.matchday,
        duration: fixture.duration,
        homeId: home.id,
        awayId: away.id,
        htHome: fixture.htHome,
        htAway: fixture.htAway,
        regularHome: fixture.homeGoals,
        regularAway: fixture.awayGoals,
        ftHome: fixture.duration === "REGULAR" ? fixture.homeGoals : null,
        ftAway: fixture.duration === "REGULAR" ? fixture.awayGoals : null,
        etHome: fixture.etHome,
        etAway: fixture.etAway,
        penHome: fixture.penHome,
        penAway: fixture.penAway,
        winner: finished ? winner(fixture.homeGoals, fixture.awayGoals) : null,
      });
    }
    console.log(`${feed.code} ${path.basename(file)}: ${parsed.fixtures.length} linhas, ${parsed.rejected} rejeitadas`);
  }
}

try {
  const before = await sql`select count(*)::int as total from matches where source = ${LIVE}`;
  await ensureSchema();
  await sql`delete from matches where source = ${SOURCE}`;
  await sql`delete from seasons where source = ${SOURCE}`;
  await sql`delete from teams where source = ${SOURCE}`;
  const byRepo = new Map();
  for (const repo of [...new Set(FEEDS.map((feed) => feed.repo))]) {
    console.log(`A transferir ${repo}`);
    byRepo.set(repo, await download(repo));
  }
  for (const feed of FEEDS) await importFeed(feed, byRepo.get(feed.repo) ?? []);
  const after = await sql`select count(*)::int as total from matches where source = ${LIVE}`;
  if (before[0].total !== after[0].total) {
    throw new Error("A contagem da origem em direto mudou.");
  }
  console.log(
    JSON.stringify({
      imported: report.imported,
      updated: report.updated,
      ignored: report.ignored,
      rejected: report.rejected,
      files: report.files,
      live: after[0].total,
    }),
  );
  for (const [code, names] of report.unlinked) {
    const top = [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    for (const [name, count] of top) console.log(`sem ligação ${code} | ${name} | ${count}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
