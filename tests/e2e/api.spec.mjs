import { test, expect } from "./fixtures.mjs";

// The actual Next.js handlers run; no third-party service is called here.
for (const path of ["recolha", "noticias", "blog-agente"]) {
  test(`POST /api/${path} denies absent and incorrect credentials`, async ({ request }) => {
    for (const headers of [{}, { "x-recolha-segredo": "incorrect" }]) {
      const response = await request.post(`/api/${path}`, { headers });
      expect(response.status()).toBe(404);
      expect(await response.text()).toBe("");
    }
  });
}

for (const path of ["news", "blogs", "forums", "reviews"]) {
  test(`/api/${path} protects both GET and POST`, async ({ request }) => {
    for (const method of ["GET", "POST"]) {
      const response = await request.fetch(`/api/${path}`, { method });
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ error: "nao-autorizado" });
    }
  });
}

test("database diagnostics stay unavailable outside production", async ({ request }) => {
  const response = await request.post("/api/diagnostico-db");
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({
    connected: false, errorCode: "PRODUCTION_REQUIRED", hostname: null, port: null,
  });
});
