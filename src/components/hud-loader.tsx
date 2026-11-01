"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { BrandMark } from "@/components/brand-mark";

type HudLoaderProps = {
  variant?: "full" | "compact";
  label?: string;
  progress?: number;
  phase?: "loading" | "exit";
};

const SEGMENT_COUNT = 60;
const BAR_COUNT = 24;

export function HudLoader({
  variant = "compact",
  label = "A preparar a página.",
  progress,
  phase = "loading",
}: HudLoaderProps) {
  const [simulatedProgress, setSimulatedProgress] = useState(8);
  const value = Math.max(0, Math.min(100, Math.round(progress ?? simulatedProgress)));

  useEffect(() => {
    if (progress !== undefined) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      const timer = window.setTimeout(() => setSimulatedProgress(68), 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setInterval(() => {
      setSimulatedProgress((current) => Math.min(96, current + Math.max(1, (96 - current) * 0.14)));
    }, 120);

    return () => window.clearInterval(timer);
  }, [progress]);

  const segments = Array.from({ length: SEGMENT_COUNT }, (_, index) => {
    const active = index < (value / 100) * SEGMENT_COUNT;
    return (
      <span
        key={index}
        className={`hud-loader__tick${active ? " is-active" : ""}`}
        style={{ "--tick-index": index } as CSSProperties}
      />
    );
  });

  return (
    <div
      className={`hud-loader hud-loader--${variant}${phase === "exit" ? " is-exiting" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="hud-loader__composition">
        {variant === "full" ? (
          <div className="hud-loader__logo" aria-hidden="true">
            <BrandMark />
          </div>
        ) : null}
        <div className="hud-loader__assembly">
          <div className="hud-loader__ring" aria-hidden="true">
            <svg className="hud-loader__arcs" viewBox="0 0 200 200" focusable="false">
              <circle className="hud-loader__arc hud-loader__arc--outer" cx="100" cy="100" r="94" />
              <circle className="hud-loader__arc hud-loader__arc--inner" cx="100" cy="100" r="78" />
            </svg>
            <div className="hud-loader__ticks">{segments}</div>
            <div className="hud-loader__core">
              <span className="hud-loader__percent">{value}%</span>
              <span className="hud-loader__core-label">SYSTEM</span>
            </div>
          </div>

          <div className="hud-loader__link-lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>

          <div className="hud-loader__panel">
            <div className="hud-loader__panel-head">
              <span className="hud-loader__signal"><i /> SIGNAL ONLINE</span>
              <span className="hud-loader__loading-word">LOADING<span className="hud-loader__dots">...</span></span>
            </div>
            <p className="hud-loader__label">{label}</p>
            <div
              className="hud-loader__bars"
              role="progressbar"
              aria-label="Progresso do carregamento"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={value}
            >
              {Array.from({ length: BAR_COUNT }, (_, index) => (
                <span
                  key={index}
                  className={index < (value / 100) * BAR_COUNT ? "is-active" : undefined}
                  style={{ "--bar-index": index } as CSSProperties}
                />
              ))}
            </div>
            <div className="hud-loader__panel-foot">
              <span>DATA STREAM</span>
              <span>{String(value).padStart(2, "0")}<b>%</b></span>
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">{label} {value}%</span>
    </div>
  );
}
