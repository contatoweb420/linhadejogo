import { localizedPath } from "@/lib/i18n";
import type { ReactNode } from "react";
import { MatchBoard } from "@/components/match-board";
import { SetupPanel } from "@/components/setup-panel";
import { pingDatabase } from "@/server/db/client";
import {
  addCalendarDays,
  formatCountry,
  lisbonToday,
} from "@/server/format/pt";
import { syncWindow } from "@/server/ingest/sync";
import { estimatesForMatches } from "@/server/estimates";
import { listCompetitions, listMatchesForDay } from "@/server/queries";
import { translate, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";

export const dynamic = "force-dynamic";

export const metadata = { title: "Jogos", description: "Calendário de futebol com resultados, horários e análise estatística por competição." };

type Search = {
  data?: string;
  competicao?: string;
  pais?: string;
};

export default async function HomePage({ searchParams }: { searchParams: Promise<Search> }) {
  const locale = await getLocale();
  const t = (text: string) => translate(locale, text);
  const params = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.data ?? "") ? params.data! : lisbonToday();
  const database = await pingDatabase();

  if (!database) {
    return (
      <div className="space-y-6">
        <PageHeading day={day} locale={locale} />
        <SearchForm locale={locale} />
        <SetupPanel database={database} />
      </div>
    );
  }

  const sync = await syncWindow(day);
  const [matches, competitions] = await Promise.all([
    listMatchesForDay(day, params.competicao || undefined, params.pais || undefined),
    listCompetitions(),
  ]);
  const estimates = await estimatesForMatches(matches);
  const listed = matches.map((match) => ({ ...match, estimate: estimates.get(match.externalId) ?? null }));
  const countries = [...new Set(competitions.map((item) => item.country).filter(Boolean))] as string[];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
        <PageHeading day={day} locale={locale} />
        <SearchForm locale={locale} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Dias" className="flex text-sm">
          <DayLink href={dayHref(addCalendarDays(day, -1), params)}>{t("Anterior")}</DayLink>
          <DayLink href={dayHref(lisbonToday(), params)} current={day === lisbonToday()}>
            {locale === "en-US" ? "Today" : "Hoje"}
          </DayLink>
          <DayLink href={dayHref(addCalendarDays(day, 1), params)}>{t("Seguinte")}</DayLink>
        </nav>
      </div>
      {competitions.length > 0 ? (
        <nav aria-label="Atalhos de competições" className="flex gap-2 overflow-x-auto pb-1">
          <Chip href={dayHref(day, { ...params, competicao: undefined })} current={!params.competicao}>
            {t("Todas")}
          </Chip>
          {competitions.map((competition) => (
            <Chip key={competition.code} href={`/competicoes/${competition.code}`} current={false}>
              {competition.name}
            </Chip>
          ))}
        </nav>
      ) : null}
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end" method="get">
        <Field label={t("Desporto")}>
          <select className="field" name="desporto" defaultValue="futebol">
            <option value="futebol">{t("Futebol")}</option>
          </select>
        </Field>
        <Field label={t("Data")}>
          <input className="field" type="date" name="data" defaultValue={day} />
        </Field>
        <Field label={t("País")}>
          <select className="field" name="pais" defaultValue={params.pais ?? ""}>
            <option value="">{t("Todos")}</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {formatCountry(country)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Competição")}>
          <select className="field" name="competicao" defaultValue={params.competicao ?? ""}>
            <option value="">{t("Todas")}</option>
            {competitions.map((competition) => (
              <option key={competition.code} value={competition.code}>
                {competition.name}
              </option>
            ))}
          </select>
        </Field>
        <button className="btn" type="submit">
          {t("Filtrar")}
        </button>
      </form>
      {matches.length === 0 ? (
        <p className="border-y border-line py-14 text-center text-sm text-muted">
          {t("Não há jogos nesta data para os filtros escolhidos.")}
          <span className="mt-1 block">{locale === "en-US" ? "If the source has no games, none are made up." : locale === "pt-BR" ? "Se a fonte não tiver partidas, nenhum dado será inventado." : "Se a origem não tiver jogos, nada é inventado."}</span>
        </p>
      ) : (
        <MatchBoard matches={listed} />
      )}
      {sync.message ? <p className="text-sm text-live">{sync.message}</p> : null}
    </div>
  );
}

function PageHeading({ day, locale }: { day: string; locale: Locale }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-forest">Linha de Jogo</p>
      <h1 className="font-serif text-4xl leading-none sm:text-5xl">{new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "Europe/Lisbon" }).format(new Date(`${day}T12:00:00Z`))}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">{locale === "en-US" ? "Open a game to compare teams. A prediction appears only when the model has enough data." : locale === "pt-BR" ? "Abra uma partida para comparar os times. A previsão só aparece quando o modelo tem dados suficientes." : "Abre um jogo para comparar as equipas. A estimativa só aparece quando o modelo tem dados suficientes."}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs uppercase tracking-[0.12em] text-muted">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function SearchForm({ locale }: { locale: Locale }) {
  const t = (text: string) => translate(locale, text);
  return (
    <form action={localizedPath("/pesquisa", locale)} method="get" className="flex gap-2">
      <label className="sr-only" htmlFor="pesquisa-rapida">
        {t("Equipa ou competição")}
      </label>
      <input
        id="pesquisa-rapida"
        name="q"
        placeholder={t("Equipa ou competição")}
        className="field w-64 max-w-full"
      />
      <button className="btn" type="submit">
        {t("Procurar")}
      </button>
    </form>
  );
}

function dayHref(day: string, params: Search) {
  const query = new URLSearchParams();
  query.set("data", day);
  if (params.pais) query.set("pais", params.pais);
  if (params.competicao) query.set("competicao", params.competicao);
  return `/jogos?${query.toString()}`;
}

function Chip({ href, current, children }: { href: string; current: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      aria-current={current ? "page" : undefined}
      className={`shrink-0 border-b-2 px-1 py-2 text-sm ${
        current ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {children}
    </a>
  );
}

function DayLink({ href, current = false, children }: { href: string; current?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      aria-current={current ? "page" : undefined}
      className={`-ml-px border border-line px-3 py-2 first:ml-0 ${current ? "is-selected relative z-10" : "text-muted hover:text-foreground"}`}
    >
      {children}
    </a>
  );
}
