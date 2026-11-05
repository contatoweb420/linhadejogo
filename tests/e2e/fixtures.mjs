import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page, baseURL }, runTest) => {
    // Font/image providers must not make local tests depend on internet access.
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.origin === new URL(baseURL).origin ? route.continue() : route.abort();
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await runTest(page);
    expect(errors, "Unhandled browser errors").toEqual([]);
  },
});

export { expect };
