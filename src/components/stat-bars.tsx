import { CountUp, GrowBar } from "@/components/chart-motion";
import { formatLocaleNumber, formatLocalePercent, translate, type Locale } from "@/lib/i18n";

type Share = {
  label: string;
  value: number;
  tone: "good" | "warn" | "accent";
};

export function OutcomeBars({ home, draw, away, locale }: { home: number; draw: number; away: number; locale: Locale }) {
  const t = (text: string) => translate(locale, text);
  const total = home + draw + away;
  const rows: Share[] = [
    { label: t("Vitória da casa"), value: home, tone: "good" },
    { label: t("Empate"), value: draw, tone: "warn" },
    { label: t("Vitória visitante"), value: away, tone: "accent" },
  ];
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <figure>
      <ul className="space-y-4">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span>{row.label}</span>
              <span className="shrink-0 text-muted">
                <CountUp value={row.value} kind="int" />
                {" · "}
                <CountUp value={total === 0 ? 0 : row.value / total} kind="share" />
              </span>
            </div>
            <GrowBar
              value={row.value}
              max={max}
              tone={row.tone}
              tip={locale === "en-US"
                ? `${row.label}: ${row.value.toLocaleString(locale)} completed games · ${new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(total === 0 ? 0 : row.value / total)}`
                : locale === "pt-BR"
                  ? `${row.label}: ${row.value.toLocaleString(locale)} partidas concluídas · ${new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(total === 0 ? 0 : row.value / total)}`
                : `${row.label}: ${formatLocaleNumber(row.value, locale)} jogos terminados · ${formatLocalePercent(total === 0 ? 0 : row.value / total, locale)}`}
            />
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">
        {locale === "en-US"
          ? `${formatLocaleNumber(total, locale)} completed games: ${formatLocaleNumber(home, locale)} home wins, ${formatLocaleNumber(draw, locale)} ties, and ${formatLocaleNumber(away, locale)} away wins.`
          : locale === "pt-BR"
            ? `Em ${formatLocaleNumber(total, locale)} partidas concluídas: ${formatLocaleNumber(home, locale)} vitórias do mandante, ${formatLocaleNumber(draw, locale)} empates e ${formatLocaleNumber(away, locale)} vitórias do visitante.`
            : `Em ${formatLocaleNumber(total, locale)} jogos terminados: ${formatLocaleNumber(home, locale)} vitórias da equipa da casa, ${formatLocaleNumber(draw, locale)} empates e ${formatLocaleNumber(away, locale)} vitórias da equipa visitante.`}
      </figcaption>
    </figure>
  );
}

export function ComparisonBars({
  leftName,
  rightName,
  rows,
  locale,
}: {
  leftName: string;
  rightName: string;
  locale: Locale;
  rows: Array<{ label: string; left: number; right: number }>;
}) {
  return (
    <figure className="space-y-5">
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 bg-accent" aria-hidden="true" />
          {leftName}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 bg-good" aria-hidden="true" />
          {rightName}
        </span>
      </figcaption>
      <ul className="space-y-4">
        {rows.map((row) => {
          const max = Math.max(row.left, row.right, 1);
          return (
            <li key={row.label}>
              <p className="text-sm text-muted">{row.label}</p>
              <div className="mt-1.5 space-y-1.5">
                <Meter name={leftName} value={row.left} max={max} tone="accent" label={row.label} locale={locale} />
                <Meter name={rightName} value={row.right} max={max} tone="good" label={row.label} locale={locale} />
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

function Meter({
  name,
  value,
  max,
  tone,
  label,
  locale,
}: {
  name: string;
  value: number;
  max: number;
  tone: "accent" | "good";
  label: string;
  locale: Locale;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-2">
      <GrowBar value={value} max={max} tone={tone} tip={`${name} · ${label}: ${formatLocaleNumber(value, locale)}`} />
      <span className="text-right text-sm">
        <CountUp value={value} kind="int" />
        <span className="sr-only"> {name}</span>
      </span>
    </div>
  );
}

export function EmptyNote({ title, text }: { title: string; text: string }) {
  return (
    <section className="border border-dashed border-line bg-card px-5 py-8">
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{text}</p>
    </section>
  );
}
