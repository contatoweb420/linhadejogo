import type { Metadata } from "next";
import { AppShell } from "@/components/site-nav";
import { StadiumHero } from "@/components/stadium-hero";
import { HomeSidebar } from "@/components/home-sidebar";
import { getSiteUrl } from "@/lib/site-url";
import { localePrefix, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";
import { headers } from "next/headers";
import "./globals.css";
import "./premium.css";

const siteUrl = getSiteUrl();
const shareImage = siteUrl ? new URL("/marca/linha-de-jogo-nova.jpg", siteUrl).toString() : undefined;

const descriptions: Record<Locale, string> = {
  "pt-BR": "Análise estatística de futebol. Previsões informativas, sem garantia de resultados.",
  "pt-PT": "Análise estatística de futebol. Estimativas informativas, sem garantia de resultados.",
  "en-US": "Soccer statistics and game previews. Informational predictions with no guaranteed results.",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const requestPath = (await headers()).get("x-site-path") || localePrefix(locale);
  const routePath = requestPath.replace(/^\/(pt-br|pt-pt|en-us)(?=\/|$)/i, "") || "/";
  const path = `${localePrefix(locale)}${routePath === "/" ? "" : routePath}`;
  const alternates = siteUrl ? {
    canonical: new URL(path, siteUrl).toString(),
    languages: {
      "pt-BR": new URL(`/pt-br${routePath === "/" ? "" : routePath}`, siteUrl).toString(),
      "pt-PT": new URL(`/pt-pt${routePath === "/" ? "" : routePath}`, siteUrl).toString(),
      "en-US": new URL(`/en-us${routePath === "/" ? "" : routePath}`, siteUrl).toString(),
      "x-default": new URL(`/pt-br${routePath === "/" ? "" : routePath}`, siteUrl).toString(),
    },
  } : undefined;
  const description = descriptions[locale];
  return {
  metadataBase: siteUrl ?? undefined,
  title: {
    default: "Linha de Jogo",
    template: "%s · Linha de Jogo",
  },
  description,
  alternates,
  openGraph: {
    type: "website",
    locale: locale === "pt-BR" ? "pt_BR" : locale === "pt-PT" ? "pt_PT" : "en_US",
    siteName: "Linha de Jogo",
    title: "Linha de Jogo",
    description,
    images: shareImage ? [{ url: shareImage, width: 1024, height: 520, alt: "Linha de Jogo" }] : undefined,
  },
  twitter: {
    card: "summary_large_image",
    title: "Linha de Jogo",
    description,
    images: shareImage ? [shareImage] : undefined,
  },
  };
}

const themeScript = `(function(){try{localStorage.setItem("quadrante.tema","dark");}catch(e){}document.documentElement.dataset.theme="dark";})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const htmlLocale = locale;
  return (
    <html lang={htmlLocale} data-theme="dark" suppressHydrationWarning className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,500;0,600;0,700;0,800;1,700;1,800&family=Inter:wght@400;500;600;700;800&family=Orbitron:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:px-3 focus:py-2"
        >
          Saltar para o conteúdo
        </a>
        <AppShell locale={locale} homeHero={<StadiumHero locale={locale} />} homeSidebar={<HomeSidebar locale={locale} />}>{children}</AppShell>
      </body>
    </html>
  );
}
