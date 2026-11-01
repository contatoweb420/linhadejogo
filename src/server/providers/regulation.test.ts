import { describe, expect, it } from "vitest";
import { FREE_TIER_CODES } from "./catalog";
import { regulationScore } from "./regulation";

describe("resultado regulamentar", () => {
  it("prefere o tempo regulamentar quando existe", () => {
    expect(regulationScore("EXTRA_TIME", { home: 1, away: 1 }, { home: 2, away: 1 })).toEqual({
      home: 1,
      away: 1,
    });
  });

  it("não usa o resultado final depois do prolongamento", () => {
    expect(regulationScore("PENALTY_SHOOTOUT", null, { home: 1, away: 1 })).toEqual({
      home: null,
      away: null,
    });
  });

  it("documenta as doze competições do plano gratuito", () => {
    expect(FREE_TIER_CODES).toHaveLength(12);
    expect(FREE_TIER_CODES).toContain("PPL");
  });
});
