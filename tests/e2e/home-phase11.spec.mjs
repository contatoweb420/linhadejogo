import { test, expect } from "./fixtures.mjs";

for (const [prefix, locale, heading] of [
  ["pt-br", "pt-BR", "Resultados recentes"],
  ["pt-pt", "pt-PT", "Resultados recentes"],
  ["en-us", "en-US", "Recent results"],
]) {
  test(`home locale and URL parameters: ${locale}`, async ({ page }) => {
    await page.goto(`/${prefix}?data=2026-11-04&competicao=PPL&x=1&x=2`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    expect(new URL(page.url()).searchParams.getAll("x")).toEqual(["1", "2"]);
    await expect(page.locator("main")).toBeVisible();
    // The default E2E server intentionally has no DB. Fixture mode runs in an
    // isolated copy, never against the developer's or production database.
    if (process.env.HOME_FIXTURE_E2E === "1") {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(page.locator("main")).toContainText("Cross-midnight fixture");
      await expect(page.locator("main")).toContainText("0–0");
      await expect(page.locator("main")).toContainText(locale === "en-US" ? "Penalties: 4–3" : locale === "pt-BR" ? "Pênaltis: 4–3" : "Penáltis: 4–3");
      await expect(page.locator(".hud-loader--full")).toHaveCount(0);
    }
  });
}

test("switching locale and unprefixed redirects retain parameters", async ({ page }) => {
  await page.goto("/pt-br?data=2026-11-04&competicao=PPL&x=1&x=2");
  await page.getByRole("button", { name: /United States/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page).toHaveURL(/\/en-us\?data=2026-11-04&competicao=PPL&x=1&x=2$/);
  await page.goto("/?data=2026-11-04&competicao=PPL&x=1&x=2");
  await expect(page).toHaveURL(/\/en-us\?data=2026-11-04&competicao=PPL&x=1&x=2$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
});

test("saved games remain interactive while secondary content is still pending", async ({ page }) => {
  test.skip(process.env.HOME_FIXTURE_E2E !== "1", "Requires isolated saved-data fixtures");
  const errors = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/en-us?slow=1", { waitUntil: "commit" });
  await expect(page.getByRole("heading", { name: "Recent results", exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText("Cross-midnight fixture");
  await expect(page.locator("main")).not.toContainText("Delayed news fixture");
  await expect(page.locator(".hud-loader--full")).toHaveCount(0);
  const link = page.locator('main a[href="/en-us/jogos"]').first();
  await link.click({ trial: true });
  await expect(page.getByRole("heading", { name: "Delayed news fixture" })).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test("postponed, cancelled and suspended games remain accessible from the home link", async ({ page }) => {
  test.skip(process.env.HOME_FIXTURE_E2E !== "1", "Requires isolated saved-data fixtures");
  await page.goto("/en-us");
  await page.getByRole("link", { name: "View games, including postponed and cancelled matches" }).click();
  await expect(page).toHaveURL(/\/en-us\/jogos$/);
  await expect(page.locator("main")).toContainText("Adiado");
  await expect(page.locator("main")).toContainText("Cancelado");
  await expect(page.locator("main")).toContainText("Suspenso");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Recent results", exact: true })).toBeVisible();
});
