import { test, expect } from "./fixtures.mjs";

for (const [prefix, language, button] of [
  ["pt-br", "pt-BR", "Brasil"],
  ["pt-pt", "pt-PT", "Portugal"],
  ["en-us", "en-US", "United States"],
]) {
  test(`renders the requested language ${language}`, async ({ page }) => {
    await page.goto(`/${prefix}/sobre`);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(page.getByRole("button", { name: new RegExp(button) })).toHaveAttribute("aria-pressed", "true");
  });
}

test("switches language and remembers it on an unprefixed visit", async ({ page }) => {
  await page.goto("/pt-br/sobre");
  await page.getByRole("button", { name: /Portugal/ }).click();
  await expect(page).toHaveURL(/\/pt-pt\/sobre$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT");
  await page.goto("/sobre");
  await expect(page).toHaveURL(/\/pt-pt\/sobre$/);
});

test("keeps the calendar date through the localized rewrite", async ({ page }) => {
  await page.goto("/pt-br/jogos?data=2024-01-15&competicao=PPL&pais=Portugal");
  // Check rendered content: the browser URL alone cannot detect a broken rewrite.
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toContainText("2024");
});

test("submits a blog search and retains its result after reload", async ({ page }) => {
  await page.goto("/pt-br/blog");
  const query = "e2e-titulo-inexistente-7a831c";
  await page.getByRole("textbox", { name: "Título", exact: true }).fill(query);
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`q=${query}`));
  await expect(page.getByRole("textbox", { name: "Título", exact: true })).toHaveValue(query);
  await expect(page.getByText("Não há artigos para esta pesquisa.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Título", exact: true })).toHaveValue(query);
});
