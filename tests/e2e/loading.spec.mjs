import { test, expect } from "./fixtures.mjs";

for (const width of [1440, 768, 390, 320]) {
  test(`ready content has no loading overlay at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/pt-br/sobre");
    await expect(page.getByRole("heading", { name: "Sobre a Linha de Jogo", exact: true })).toBeVisible();
    await expect(page.locator('[role="status"][aria-busy="true"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto("/pt-br/jogos");
    await expect(page.getByRole("heading", { name: "Base de dados em falta" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Sobre a Linha de Jogo", exact: true })).toBeVisible();
    await expect(page.locator('[role="status"][aria-busy="true"]')).toHaveCount(0);
  });
}

test.describe("isolated slow route fixtures", () => {
  test.skip(process.env.LOADING_FIXTURE_E2E !== "1", "Routes exist only in the isolated loading validation build");

  for (const width of [1440, 768, 390, 320]) {
    test(`initial streaming and internal navigation at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const gate = crypto.randomUUID();
      await page.goto(`/pt-br/loading-check/hold?gate=${gate}`, { waitUntil: "commit" });
      const loading = page.locator('main [role="status"][aria-busy="true"]');
      // Read the transient fallback in one browser task: it may unmount as soon as data arrives.
      const pending = await page.waitForFunction(() => {
        const element = document.querySelector('main [role="status"][aria-busy="true"]');
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          display: getComputedStyle(element).display,
          live: element.getAttribute("aria-live"),
          count: document.querySelectorAll('main [role="status"][aria-busy="true"]').length,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      const state = await pending.jsonValue();
      expect(state.height).toBeGreaterThan(0);
      expect(state.height).toBeLessThan(500);
      expect(state.width).toBeLessThanOrEqual(width);
      expect(state.display).toBe("grid");
      expect(state.live).toBe("polite");
      expect(state.count).toBe(1);
      expect(state.overflow).toBe(false);
      // External SVG symbols must resolve; a missing sprite would leave the field/ball blank.
      await page.waitForFunction(() => {
        const symbols = [...document.querySelectorAll("main .ldj-loading svg use")];
        return symbols.length === 4 && symbols.every(symbol => {
          const box = symbol.getBBox();
          return box.width > 0 && box.height > 0;
        });
      });
      await expect(page.locator("header")).toBeVisible();
      expect((await page.request.get(`/api/loading-validation?gate=${gate}`)).ok()).toBe(true);
      await expect(page.getByRole("heading", { name: "Slow content ready" })).toBeVisible();
      await expect(loading).toHaveCount(0);
      await page.getByRole("link", { name: "Back to validation", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Loading validation ready" })).toBeVisible();
      // A fresh document makes this a cold internal navigation.
      await page.goto("/pt-br/loading-check");
      await page.getByRole("link", { name: "Slow route", exact: true }).click();
      await expect(loading).toBeVisible();
      await expect(page.getByRole("heading", { name: "Slow content ready" })).toBeVisible();
      await expect(loading).toHaveCount(0);
      await page.goBack();
      await expect(page.getByRole("heading", { name: "Loading validation ready" })).toBeVisible();
      await page.goForward();
      await expect(page.getByRole("heading", { name: "Slow content ready" })).toBeVisible();
      await expect(loading).toHaveCount(0);
      // Returning through the client router cache must never mount a shell loader.
      await expect(page.locator('.premium-shell > [role="status"]')).toHaveCount(0);
    });
  }

  test("shot enters the goal, moves the net and resets without moving the loading card", async ({ page }) => {
    const gate = crypto.randomUUID();
    await page.goto(`/pt-br/loading-check/hold?gate=${gate}`, { waitUntil: "commit" });
    const loading = page.locator("main .ldj-loading");
    await expect(loading).toBeVisible();
    const phase = milliseconds => loading.evaluate(async (element, time) => {
      for (const animation of element.getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = time;
      }
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const matrix = selector => {
        const value = new DOMMatrix(getComputedStyle(element.querySelector(selector)).transform);
        return { x: value.e, y: value.f, scale: value.a };
      };
      return {
        shot: matrix(".ldj-loading__shot"),
        net: getComputedStyle(element.querySelector(".ldj-loading__net")).transform,
        opacity: Number(getComputedStyle(element.querySelector(".ldj-loading__shot")).opacity),
        height: element.getBoundingClientRect().height,
      };
    }, milliseconds);
    const start = await phase(400);
    const goal = await phase(2560);
    const impact = await phase(2640);
    const reset = await phase(4400);
    expect(start.shot.y).toBeCloseTo(280);
    // Mouth: x=275..445, y=74..153; ball radius at impact is 22 * scale.
    expect(goal.shot.x - 22 * goal.shot.scale).toBeGreaterThan(275);
    expect(goal.shot.x + 22 * goal.shot.scale).toBeLessThan(445);
    expect(goal.shot.y - 22 * goal.shot.scale).toBeGreaterThan(74);
    expect(goal.shot.y + 22 * goal.shot.scale).toBeLessThan(153);
    expect(goal.shot.scale).toBeLessThan(start.shot.scale);
    expect(impact.net).not.toBe(start.net);
    expect(reset.shot).toEqual(start.shot);
    expect(reset.opacity).toBe(1);
    expect(impact.height).toBe(start.height);
    // Data wins over a paused goal animation; no animationend or minimum display time.
    expect((await page.request.get(`/api/loading-validation?gate=${gate}`)).ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Slow content ready" })).toBeVisible();
    await expect(loading).toHaveCount(0);
    expect(await page.evaluate(() => document.getAnimations().filter(a => a.animationName?.startsWith("ldj-")).length)).toBe(0);
  });

  test("navigation can leave a pending shot without waiting for a goal", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("linha-de-jogo.analytics-consent.v1", "denied"));
    const gate = crypto.randomUUID();
    await page.goto(`/pt-br/loading-check/hold?gate=${gate}`, { waitUntil: "commit" });
    await expect(page.locator("main .ldj-loading")).toBeVisible();
    await expect(page.getByRole("button", { name: "Preferências de cookies", exact: true })).toBeVisible();
    await page.locator("footer").getByRole("link", { name: "Privacidade", exact: true }).click();
    await expect(page).toHaveURL(/\/pt-br\/privacidade$/);
    await expect(page.locator("main .ldj-loading")).toHaveCount(0);
    // Release the abandoned test request so it does not keep the fixture busy.
    await page.request.get(`/api/loading-validation?gate=${gate}`);
  });

  test("a failed response replaces the animation with the existing error screen", async ({ browser, baseURL, isMobile }) => {
    const context = await browser.newContext({ viewport: { width: isMobile ? 390 : 1440, height: 900 }, isMobile, hasTouch: isMobile });
    try {
      const page = await context.newPage();
      await page.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort());
      await page.goto(baseURL + "/pt-br/loading-check");
      await page.getByRole("link", { name: "Error route", exact: true }).click();
      await expect(page.locator("main .ldj-loading")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Não foi possível mostrar esta página" })).toBeVisible();
      await expect(page.locator("main .ldj-loading")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Tentar outra vez", exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("reduced motion keeps the status readable and stops every loader animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const gate = crypto.randomUUID();
    await page.goto(`/pt-br/loading-check/hold?gate=${gate}`, { waitUntil: "commit" });
    const loading = page.locator('main [role="status"]');
    await expect(loading).toBeVisible();
    expect(await loading.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
    expect((await page.request.get(`/api/loading-validation?gate=${gate}`)).ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Slow content ready" })).toBeVisible();
    await expect(loading).toHaveCount(0);
  });
});
