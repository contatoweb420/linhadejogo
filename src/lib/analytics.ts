export const measurementId = "G-4VPJ6H0Z8N";
export const consentKey = "linha-de-jogo.analytics-consent.v1";

// Runs before hydration and before any Google measurement command.
export const consentDefaults = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
});
`;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    linhaAnalyticsStarted?: boolean;
  }
}

export function updateAnalyticsConsent(granted: boolean) {
  window.gtag("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  if (granted && !window.linhaAnalyticsStarted) {
    window.linhaAnalyticsStarted = true;
    window.gtag("js", new Date());
    // The Google tag has historyEvents enabled: use its SPA tracking only.
    window.gtag("config", measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }
}
