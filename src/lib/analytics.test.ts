import { afterEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { consentDefaults, measurementId, updateAnalyticsConsent } from "./analytics";

afterEach(() => vi.unstubAllGlobals());

describe("GA4 consent and navigation", () => {
  it("denies every Consent Mode v2 storage and advertising signal before measurement", () => {
    const context = { window: {} };
    Object.assign(context, { window: context });
    runInNewContext(consentDefaults, context);
    const commands = (context as unknown as { dataLayer: unknown[][] }).dataLayer;
    expect(Array.from(commands[0])).toEqual(["consent", "default", {
      analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    }]);
    expect(commands).toHaveLength(1);
  });

  it("configures once and applies withdrawal", () => {
    const gtag = vi.fn();
    const win = { gtag, location: { href: "https://example.test/sobre" } };
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", { title: "Sobre", referrer: "" });
    updateAnalyticsConsent(false);
    expect(gtag).toHaveBeenCalledTimes(1);
    updateAnalyticsConsent(true);
    updateAnalyticsConsent(true);
    expect(gtag.mock.calls.filter(call => call[0] === "config")).toEqual([["config", measurementId, {
      allow_google_signals: false, allow_ad_personalization_signals: false,
    }]]);
    updateAnalyticsConsent(false);
    expect(gtag).toHaveBeenLastCalledWith("consent", "update", {
      analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    });
  });
});
