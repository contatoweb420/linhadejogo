import { NextResponse, type NextRequest } from "next/server";

const locales = ["pt-br", "pt-pt", "en-us"] as const;
const localeCookie = "linha-de-jogo-locale";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0]?.toLowerCase();
  // Some deployments invoke Proxy again for the internal rewrite destination.
  // Accept only a valid locale/path pair that maps exactly to this destination.
  // These are presentation hints, never authorization or collection credentials.
  const forwardedLocale = request.headers.get("x-site-locale");
  const forwardedPath = request.headers.get("x-site-path");
  if (!locales.includes(first as (typeof locales)[number]) &&
      locales.includes(forwardedLocale as (typeof locales)[number]) &&
      forwardedPath?.startsWith(`/${forwardedLocale}`)) {
    const parts = forwardedPath.split("/").filter(Boolean);
    if (parts[0] === forwardedLocale && `/${parts.slice(1).join("/")}` === pathname) {
      return NextResponse.next();
    }
  }
  if (locales.includes(first as (typeof locales)[number])) {
    const locale = first as (typeof locales)[number];
    const destination = new URL(request.url);
    // NextURL normalizes loopback hosts to localhost. Keep rewrites on the
    // incoming origin, including when development is accessed via 127.0.0.1.
    if (request.headers.get("host")) destination.host = request.headers.get("host")!;
    destination.pathname = `/${segments.slice(1).join("/")}`;
    const headers = new Headers(request.headers);
    headers.set("x-site-locale", locale);
    headers.set("x-site-path", pathname);
    const response = NextResponse.rewrite(destination, { request: { headers } });
    response.headers.set("x-site-locale", locale);
    response.headers.set("x-site-path", pathname);
    response.cookies.set(localeCookie, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return response;
  }

  const saved = request.cookies.get(localeCookie)?.value;
  const locale = locales.includes(saved as (typeof locales)[number]) ? saved! : "pt-br";
  const destination = new URL(request.url);
  if (request.headers.get("host")) destination.host = request.headers.get("host")!;
  destination.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(destination);
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"] };
