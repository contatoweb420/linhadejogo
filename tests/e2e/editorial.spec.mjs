import { test, expect } from "./fixtures.mjs";

test("requires authentication before showing editorial controls", async ({ page }) => {
  await page.goto("/pt-br/redacao");
  await expect(page.getByLabel("Segredo de recolha", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gerar agora", exact: true })).toHaveCount(0);
});

test("rejects an incorrect editorial secret", async ({ page }) => {
  await page.goto("/pt-br/redacao");
  await page.getByLabel("Segredo de recolha", { exact: true }).fill("segredo-incorreto");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("O acesso não foi aceite.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gerar agora", exact: true })).toHaveCount(0);
});

test("keeps an authenticated session after redirect and reload", async ({ page }) => {
  await page.goto("/pt-br/redacao");
  await page.getByLabel("Segredo de recolha", { exact: true }).fill("local-playwright-only-not-a-real-secret");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Artigos", exact: true })).toBeVisible();
  await expect(page.getByText("Ainda não há rascunhos.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Artigos", exact: true })).toBeVisible();
});
