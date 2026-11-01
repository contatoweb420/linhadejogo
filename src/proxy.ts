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
  if (locales.includes(first as (typeof locales)[number])) {
    const locale = first as (typeof locales)[number];
    const response = NextResponse.rewrite(new URL(`/${segments.slice(1).join("/")}`, request.url));
    response.headers.set("x-site-locale", locale);
    response.headers.set("x-site-path", pathname);
    response.cookies.set(localeCookie, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return response;
  }

  const saved = request.cookies.get(localeCookie)?.value;
  const locale = locales.includes(saved as (typeof locales)[number]) ? saved! : "pt-br";
  const destination = request.nextUrl.clone();
  destination.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(destination);
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"] };
