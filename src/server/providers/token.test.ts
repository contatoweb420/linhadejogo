import { afterEach, describe, expect, it } from "vitest";
import { footballDataToken } from "./football-data";

const previousKey = process.env.FOOTBALL_DATA_API_KEY;
const previousToken = process.env.FOOTBALL_DATA_TOKEN;

afterEach(() => {
  if (previousKey === undefined) delete process.env.FOOTBALL_DATA_API_KEY;
  else process.env.FOOTBALL_DATA_API_KEY = previousKey;
  if (previousToken === undefined) delete process.env.FOOTBALL_DATA_TOKEN;
  else process.env.FOOTBALL_DATA_TOKEN = previousToken;
});

describe("footballDataToken", () => {
  it("lê a chave do servidor sem usar um valor fixo no código", () => {
    process.env.FOOTBALL_DATA_API_KEY = "chave-de-teste";
    process.env.FOOTBALL_DATA_TOKEN = "outra-chave";
    expect(footballDataToken()).toBe("chave-de-teste");
  });

  it("aceita o nome antigo quando a variável principal está vazia", () => {
    process.env.FOOTBALL_DATA_API_KEY = "  ";
    process.env.FOOTBALL_DATA_TOKEN = "chave-antiga";
    expect(footballDataToken()).toBe("chave-antiga");
  });
});
