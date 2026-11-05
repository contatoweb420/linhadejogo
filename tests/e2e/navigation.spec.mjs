import { test, expect } from "./fixtures.mjs";

test("redirects an unprefixed page to the default language", async ({ page }) => {
  await page.goto("/sobre");
  await expect(page).toHaveURL(/\/pt-br\/sobre$/);
  await expect(page.getByRole("heading", { name: "Sobre a Linha de Jogo", exact: true })).toBeVisible();
});

test("navigates from the menu on desktop and mobile", async ({ page, isMobile }) => {
  await page.goto("/pt-br/sobre");
  const menu = page.getByRole("navigation", { name: isMobile ? "Navegação principal" : "Secções", exact: true });
  await menu.getByRole("link", { name: "Jogos", exact: true }).click();
  await expect(page).toHaveURL(/\/pt-br\/jogos$/);
  await expect(page.getByRole("heading", { name: "Base de dados em falta" })).toBeVisible();
});

test("shows an explicit unavailable state without a database", async ({ page }) => {
  await page.goto("/pt-br/jogos");
  await expect(page.getByRole("heading", { name: "Base de dados em falta" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("npm run db:migrate");
});

test("renders the application 404 page", async ({ page }) => {
  await page.goto("/pt-br/e2e-pagina-inexistente");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar aos jogos" })).toBeVisible();
});
