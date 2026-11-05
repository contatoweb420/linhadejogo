import { describe, expect, it } from "vitest";
import { homeDateTime, homeResultDetails, homeText } from "./home-presentation";

describe("home result presentation", () => {
  it("keeps zero scores and distinguishes regulation, source extra time and penalties", () => {
    const result = homeResultDetails({ regularHome: 0, regularAway: 0, duration: "PENALTY_SHOOTOUT", ftHome: 1, ftAway: 1, etHome: 1, etAway: 1, penHome: 4, penAway: 3 }, "en-US");
    expect(result).toContain("Regulation score: 0–0");
    expect(result).toContain("Extra-time score reported by source: 1–1");
    expect(result).toContain("Full-time score reported by source: 1–1");
    expect(result).toContain("Penalties: 4–3");
  });
  it("does not infer missing scores from other periods or turn them into zero", () => {
    const result = homeResultDetails({ regularHome: null, regularAway: null, duration: "EXTRA_TIME", ftHome: 2, ftAway: 1 }, "en-US");
    expect(result).toContain("Regulation score: Unavailable");
    expect(result).toContain("Extra-time score reported by source: Unavailable");
    expect(result.join()).not.toContain("0–0");
  });
  it.each(["pt-BR", "pt-PT", "en-US"] as const)("formats dates in %s while retaining Lisbon time", locale => {
    const date = new Date("2026-07-01T23:30:00Z");
    expect(homeDateTime(date, locale)).toBe(new Intl.DateTimeFormat(locale, { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date));
  });
  it("translates saved statuses without changing their meaning", () => {
    expect(homeText("en-US", "Adiado")).toBe("Postponed");
    expect(homeText("en-US", "Cancelado")).toBe("Cancelled");
    expect(homeText("en-US", "Intervalo")).toBe("Half-time");
    expect(homeText("pt-BR", "Penáltis")).toBe("Pênaltis");
  });
});
