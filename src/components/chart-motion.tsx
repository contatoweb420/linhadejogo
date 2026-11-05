"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/components/locale-context";

type MotionState = { ready: boolean; reduced: boolean };

const MotionContext = createContext<MotionState>({ ready: true, reduced: false });

function useMotion() {
  return useContext(MotionContext);
}

function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setReady(true);
        observer.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  return { ref, ready: ready || reduced, reduced };
}

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { ref, ready, reduced } = useInView();
  const shown = ready || reduced;
  return (
    <MotionContext.Provider value={{ ready: shown, reduced }}>
      <div ref={ref} className={`reveal ${shown ? "is-shown" : ""} ${className}`}>
        {children}
      </div>
    </MotionContext.Provider>
  );
}

type Kind = "int" | "num" | "pct" | "share" | "gap";

function formatKind(value: number, kind: Kind, locale: string) {
  if (kind === "int") return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value));
  if (kind === "pct" || kind === "gap") return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)} %`;
  if (kind === "share") return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

function useAnimatedNumber(value: number, ready: boolean, reduced: boolean) {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (reduced) {
      shownRef.current = value;
      started.current = true;
      return;
    }
    const from = started.current ? shownRef.current : 0;
    started.current = true;
    if (Math.abs(from - value) < 0.001) {
      shownRef.current = value;
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 800);
      const eased = 1 - (1 - progress) ** 3;
      const next = from + (value - from) * eased;
      shownRef.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else {
        shownRef.current = value;
        setShown(value);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, ready, reduced]);

  return shown;
}

export function CountUp({ value, kind }: { value: number; kind: Kind }) {
  const locale = useLocale();
  const { ready, reduced } = useMotion();
  const shown = useAnimatedNumber(value, ready, reduced);
  const finalText = formatKind(value, kind, locale);
  return (
    <span className="tabular" aria-label={finalText}>
      <span aria-hidden="true">{reduced ? finalText : formatKind(shown, kind, locale)}</span>
    </span>
  );
}

const barTone = {
  primary: "bg-primary",
  accent: "bg-accent",
  info: "bg-info",
  good: "bg-good",
  warn: "bg-warn",
} as const;

export function GrowBar({
  value,
  max,
  tone,
  tip,
}: {
  value: number;
  max: number;
  tone: keyof typeof barTone;
  tip: string;
}) {
  const { ready, reduced } = useMotion();
  const target = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const width = reduced || ready ? target : 0;
  return (
    <div className="group/bar relative py-1" tabIndex={0} role="img" aria-label={tip}>
      <div className="h-2.5 overflow-hidden rounded-full bg-raised">
        <div className={`bar-grow h-full rounded-full ${barTone[tone]}`} style={{ width: `${width}%` }} />
      </div>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.35rem)] left-0 z-20 hidden max-w-[16rem] rounded-md border border-line bg-raised px-2 py-1 text-xs leading-5 text-foreground shadow-[0_8px_24px_rgb(0_0_0/0.28)] group-hover/bar:block group-focus-within/bar:block"
      >
        {tip}
      </span>
    </div>
  );
}

export type LinePoint = { date: string; caption: string };
export type LineSeries = {
  name: string;
  tone: "primary" | "warn" | "good";
  values: (number | null)[];
  digits?: 0 | 1 | 2;
  suffix?: string;
};

const strokeTone = {
  primary: "var(--primary)",
  warn: "var(--warning)",
  good: "var(--success)",
} as const;

const dotTone = {
  primary: "bg-primary",
  warn: "bg-warn",
  good: "bg-good",
} as const;

function formatSeriesValue(value: number | null | undefined, digits: 0 | 1 | 2, locale: string) {
  return value == null || !Number.isFinite(value) ? "—" : value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function xPercent(index: number, count: number) {
  if (count <= 1) return 50;
  return 8 + (index / (count - 1)) * 84;
}

function yPercent(value: number, max: number) {
  const safe = max <= 0 ? 1 : max;
  return 86 - (value / safe) * 72;
}

export function LineChart({
  points,
  series,
  label,
  signature,
  scaleMax,
}: {
  points: LinePoint[];
  series: LineSeries[];
  label: string;
  signature: string;
  scaleMax?: number;
}) {
  const locale = useLocale();
  const { ready, reduced } = useMotion();
  const [drawn, setDrawn] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const labelId = useId();
  const count = points.length;
  const max = Math.max(1, scaleMax ?? 0, ...series.flatMap((item) => item.values.filter((value): value is number => value != null && Number.isFinite(value))));

  useEffect(() => {
    if (!ready) return;
    if (reduced) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setDrawn(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [ready, reduced, signature]);

  const chartDrawn = drawn || reduced;

  if (count === 0 || series.some((item) => item.values.length !== count)) return null;

  const line = (values: (number | null)[]) => {
    let previous: { x: number; y: number } | null = null;
    return values.map((value, index) => {
      if (value == null || !Number.isFinite(value)) { previous = null; return ""; }
      const x = xPercent(index, count);
      const y = yPercent(value, max);
      const command = previous ? `C${previous.x + (x - previous.x) / 2} ${previous.y} ${previous.x + (x - previous.x) / 2} ${y} ${x} ${y}` : `M${x} ${y}`;
      previous = { x, y };
      return command;
    }).join(" ");
  };

  const choose = (index: number) => setActive(Math.max(0, Math.min(count - 1, index)));

  return (
    <figure aria-labelledby={`${labelId}-summary`}>
      <div
        className="relative h-52 sm:h-60"
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setActive(null);
        }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
          <path d="M8 86 H92" fill="none" stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {[0, 0.5, 1].map(fraction => <path key={fraction} d={`M8 ${yPercent(max * fraction, max)} H92`} fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
          {series.map((item) =>
            item.values.length < 2 ? null : (
              <path
                key={item.name}
                d={line(item.values)}
                fill="none"
                stroke={strokeTone[item.tone]}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                className="line-draw"
                style={{ strokeDasharray: 1, strokeDashoffset: chartDrawn ? 0 : 1 }}
              />
            ),
          )}
        </svg>
        {[0, 0.5, 1].map(fraction => <span key={fraction} className="pointer-events-none absolute left-0 -translate-y-1/2 text-[10px] text-muted tabular-nums" style={{ top: `${yPercent(max * fraction, max)}%` }}>{formatSeriesValue(max * fraction, Number.isInteger(max * fraction) ? 0 : 1, locale)}</span>)}
        {points.map((point, index) => (
          <button
            key={`${point.date}-${index}`}
            type="button"
            className="absolute top-0 h-full -translate-x-1/2 cursor-crosshair"
            style={{ left: `${xPercent(index, count)}%`, width: count === 1 ? "100%" : `${Math.min(16, 84 / count)}%` }}
            aria-label={pointLabel(point, series, index, locale)}
            aria-describedby={active === index ? labelId : undefined}
            onBlur={() => setActive(null)}
            onKeyDown={event => { if (event.key === "Escape") setActive(null); }}
            onFocus={() => choose(index)}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") choose(index);
            }}
            onPointerDown={() => choose(index)}
          />
        ))}
        {series.map((item) =>
          item.values.map((value, index) => value == null || !Number.isFinite(value) ? null : (
            <span
              key={`${item.name}-${index}`}
              className={`chart-dot pointer-events-none absolute h-2.5 w-2.5 rounded-full border border-background ${dotTone[item.tone]} ${active === index ? "is-active" : ""}`}
              style={{ left: `${xPercent(index, count)}%`, top: `${yPercent(value, max)}%` }}
            />
          )),
        )}
        {active != null ? (
          <div
            role="tooltip"
            id={labelId}
            className="pointer-events-none absolute top-0 z-20 max-w-[14rem] rounded-md border border-line bg-raised px-2.5 py-1.5 text-xs leading-5 text-foreground shadow-[0_8px_24px_rgb(0_0_0/0.28)]"
            style={{ left: `${Math.max(4, Math.min(96, xPercent(active, count)))}%`, transform: active > (count - 1) / 2 ? "translateX(-100%)" : undefined }}
          >
            <p className="text-muted">{formatChartDate(points[active].date, locale)}</p>
            <p>{points[active].caption}</p>
            {series.map((item) => (
              <p key={item.name} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${dotTone[item.tone]}`} aria-hidden="true" />
                {item.name}: {formatSeriesValue(item.values[active], item.digits ?? 0, locale)}
                {item.suffix ?? ""}
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="relative mt-2 h-5 text-[10px] text-muted">
        {points.map((point, index) => index === 0 || index === count - 1 || (count > 4 && index === Math.floor((count - 1) / 2)) ? <span key={`${point.date}-${index}`} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${xPercent(index, count)}%` }}>{new Intl.DateTimeFormat(locale, { timeZone: "Europe/Lisbon", day: "2-digit", month: "short" }).format(new Date(point.date))}</span> : null)}
      </div>
      <figcaption className="sr-only" id={`${labelId}-summary`}>
        {label}
      </figcaption>
    </figure>
  );
}

function formatChartDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone: "Europe/Lisbon", dateStyle: "medium" }).format(new Date(date));
}

function pointLabel(point: LinePoint, series: LineSeries[], index: number, locale: string) {
  const values = series
    .map((item) => `${item.name}: ${formatSeriesValue(item.values[index], item.digits ?? 0, locale)}${item.suffix ?? ""}`)
    .join(". ");
  return `${formatChartDate(point.date, locale)}. ${point.caption}. ${values}`;
}
