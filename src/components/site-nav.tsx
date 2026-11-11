"use client";

import Link from "@/components/localized-link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { localePrefix, translate, type Locale } from "@/lib/i18n";
import { LocaleProvider } from "@/components/locale-context";

const STORAGE_KEY = "quadrante.menu";
const CHANGE_EVENT = "quadrante-menu";

type Item = {
  href: string;
  label: string;
  icon: IconName;
  current: (path: string) => boolean;
};

const mainItems: Item[] = [
  { href: "/", label: "Visão geral", icon: "home", current: (path) => path === "/" },
  { href: "/jogos", label: "Jogos", icon: "calendar", current: (path) => path === "/jogos" },
  { href: "/analise", label: "Análise de jogos", icon: "chart", current: (path) => path.startsWith("/analise") || /^\/jogos\/[^/]+/.test(path) },
  { href: "/competicoes", label: "Competições", icon: "trophy", current: (path) => path.startsWith("/competicoes") },
  { href: "/pesquisa", label: "Equipas", icon: "teams", current: (path) => path.startsWith("/pesquisa") || path.startsWith("/equipas") },
  { href: "/avaliacao", label: "Estatísticas", icon: "bars", current: (path) => path.startsWith("/avaliacao") },
  { href: "/blog", label: "Blog", icon: "news", current: (path) => path.startsWith("/blog") },
  { href: "/noticias", label: "Notícias", icon: "feed", current: (path) => path.startsWith("/noticias") },
];

const menuGroups = [
  { label: "Jogo", items: mainItems.slice(0, 3) },
  { label: "Competição", items: mainItems.slice(3, 6) },
  { label: "Leitura", items: mainItems.slice(6) },
];

const moreItems: Item[] = [
  mainItems[3],
  mainItems[4],
  mainItems[5],
  mainItems[6],
  mainItems[7],
  { href: "/sobre", label: "Sobre", icon: "info", current: (path) => path.startsWith("/sobre") },
];

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function readCollapsed() {
  return window.localStorage.getItem(STORAGE_KEY) === "icons";
}

function writeCollapsed(collapsed: boolean) {
  window.localStorage.setItem(STORAGE_KEY, collapsed ? "icons" : "full");
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function AppShell({ children, locale, homeHero, homeSidebar }: { children: ReactNode; locale: Locale; homeHero?: ReactNode; homeSidebar?: ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const pathname = usePathname();
  const home = stripLocale(pathname) === "/";
  const content = <main id="conteudo" className={home ? "site-main home-center" : "site-main"}>{children}</main>;

  return (
    <LocaleProvider locale={locale}>
    <div className={`premium-shell pb-20 md:pb-0${home ? " premium-shell--home" : ""}`}>
      <SiteHeader locale={locale} pathname={stripLocale(pathname)} />
      <div className={home ? "site-content site-content--home" : `site-content site-content--inside ${collapsed ? "site-content--compact" : ""}`}>
        {home ? <>
          {homeHero}
          <div className="home-grid home-grid--overview">{homeSidebar}{content}</div>
        </> : <>
          <Sidebar collapsed={collapsed} pathname={stripLocale(pathname)} locale={locale} />
          {content}
        </>}
      </div>
      <SiteFooter locale={locale} />
      <MobileNav pathname={stripLocale(pathname)} locale={locale} />
    </div>
    </LocaleProvider>
  );
}

function Sidebar({ collapsed, pathname, locale }: { collapsed: boolean; pathname: string; locale: Locale }) {
  const t = (text: string) => translate(locale, text);
  return (
    <aside
      className="chrome nav-aside hidden min-w-0 flex-col md:flex"
    >
      <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Secções">
        {menuGroups.map((group) => (
          <div key={group.label}>
            {collapsed ? null : (
              <p className="px-3 pb-1 pt-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">{t(group.label)}</p>
            )}
            <ul className="grid gap-1">
              {group.items.map((item) => (
                <li key={item.label}>
                  <NavLink item={item} pathname={pathname} collapsed={collapsed} locale={locale} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="grid gap-2 border-t border-line p-2">
        <p className={`flex min-h-11 items-center gap-3 px-3 py-2 text-sm text-muted ${collapsed ? "justify-center" : ""}`} title="Premium ainda não está disponível">
          <Icon name="premium" />
          {collapsed ? <span className="sr-only">Premium · {t("Não disponível")}</span> : <span>Premium · {t("Não disponível")}</span>}
        </p>
        <Link
          href={`${localePrefix(locale)}/sobre`}
          aria-current={pathname.startsWith("/sobre") ? "page" : undefined}
          title={collapsed ? "Sobre" : undefined}
          className={linkClass(pathname.startsWith("/sobre"), collapsed)}
        >
          <Icon name="info" />
          {collapsed ? <span className="sr-only">{t("Sobre")}</span> : <span>{t("Sobre")}</span>}
        </Link>
        <button
          type="button"
          className="flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-sm text-muted hover:bg-raised hover:text-foreground"
          aria-pressed={collapsed}
          onClick={() => writeCollapsed(!collapsed)}
        >
          <Icon name={collapsed ? "expand" : "collapse"} />
          <span className={collapsed ? "sr-only" : ""}>{t(collapsed ? "Expandir menu" : "Recolher menu")}</span>
        </button>
      </div>
    </aside>
  );
}

function MobileNav({ pathname, locale }: { pathname: string; locale: Locale }) {
  const t = (text: string) => translate(locale, text);
  const more = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (more.current) more.current.open = false;
  }, [pathname]);

  return (
    <nav className="chrome fixed inset-x-0 bottom-0 z-40 border-t border-line md:hidden" aria-label="Navegação principal">
      <ul className="grid grid-cols-4">
        <MobileItem href={localePrefix(locale)} label={t("Início")} icon="home" current={pathname === "/"} />
        <MobileItem href={`${localePrefix(locale)}/jogos`} label={t("Jogos")} icon="calendar" current={pathname === "/jogos"} />
        <MobileItem href={`${localePrefix(locale)}/analise`} label={t("Análise de jogos")} icon="chart" current={pathname.startsWith("/analise") || /^\/jogos\/[^/]+/.test(pathname)} />
        <li>
          <MoreMenu pathname={pathname} panel={more} locale={locale} />
        </li>
      </ul>
    </nav>
  );
}

function MoreMenu({ pathname, panel, locale }: { pathname: string; panel: RefObject<HTMLDetailsElement | null>; locale: Locale }) {
  const t = (text: string) => translate(locale, text);
  return (
    <details ref={panel} className="group">
      <summary
        className={`flex min-h-16 cursor-pointer list-none flex-col items-center justify-center gap-1 px-1 text-xs group-open:text-primary [&::-webkit-details-marker]:hidden ${moreItems.some((item) => item.current(pathname)) ? "bg-raised font-semibold text-primary" : "text-muted"}`}
      >
        <Icon name="more" />
        {t("Mais")}
      </summary>
      <div className="fixed inset-x-3 bottom-16 z-40 border border-line bg-card p-2 shadow-[0_12px_32px_rgb(0_0_0/0.28)]">
        <ul>
          {moreItems.map((item) => (
            <li key={item.label}>
              <Link
                href={`${localePrefix(locale)}${item.href === "/" ? "" : item.href}`}
                aria-current={item.current(pathname) ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 px-3 text-sm hover:bg-raised hover:text-primary ${item.current(pathname) ? "bg-raised font-semibold text-primary" : ""}`}
              >
                <Icon name={item.icon} />
                {t(item.label)}
              </Link>
            </li>
          ))}
          <li className="px-3 py-3 text-sm text-muted">Premium · {t("Não disponível")}</li>
        </ul>
      </div>
    </details>
  );
}

function MobileItem({ href, label, icon, current }: { href: string; label: string; icon: IconName; current: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs ${current ? "bg-raised font-semibold text-primary" : "text-muted"}`}
      >
        <Icon name={icon} />
        {label}
      </Link>
    </li>
  );
}

function NavLink({ item, pathname, collapsed, locale }: { item: Item; pathname: string; collapsed: boolean; locale: Locale }) {
  const label = translate(locale, item.label);
  const current = item.current(pathname);
  return (
    <Link
      href={`${localePrefix(locale)}${item.href === "/" ? "" : item.href}`}
      aria-current={current ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={linkClass(current, collapsed)}
    >
      <Icon name={item.icon} />
      {collapsed ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </Link>
  );
}

function linkClass(current: boolean, collapsed: boolean) {
  return `flex min-h-10 items-center gap-3 px-3 py-1.5 text-sm ${collapsed ? "justify-center" : ""} ${
    current ? "bg-raised font-semibold text-primary shadow-[inset_3px_0_0_0_var(--brand-green)]" : "text-muted hover:bg-raised hover:text-primary"
  }`;
}

type IconName = "home" | "calendar" | "chart" | "trophy" | "teams" | "bars" | "info" | "more" | "collapse" | "expand" | "premium" | "news" | "feed";

function stripLocale(pathname: string) {
  return pathname.replace(/^\/(pt-br|pt-pt|en-us)(?=\/|$)/i, "") || "/";
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {name === "home" ? <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /> : null}
      {name === "calendar" ? (
        <>
          <rect x="4" y="5" width="16" height="15" rx="1" />
          <path d="M8 3.5V7M16 3.5V7M4 10h16" />
        </>
      ) : null}
      {name === "chart" ? <path d="M4 19h16M7 16V10M12 16V6M17 16v-4" /> : null}
      {name === "trophy" ? <path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M12 14v3M9 20h6" /> : null}
      {name === "teams" ? (
        <>
          <circle cx="9" cy="8" r="2.5" />
          <circle cx="16" cy="9" r="2" />
          <path d="M4.5 18a4.5 4.5 0 0 1 9 0M13 18a3.5 3.5 0 0 1 6.5-1.8" />
        </>
      ) : null}
      {name === "bars" ? <path d="M5 19V11M12 19V5M19 19v-7" /> : null}
      {name === "info" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 11v5M12 8h.01" />
        </>
      ) : null}
      {name === "more" ? (
        <>
          <circle cx="6" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="18" cy="12" r="1" fill="currentColor" />
        </>
      ) : null}
      {name === "collapse" ? <path d="M15 6 9 12l6 6" /> : null}
      {name === "expand" ? <path d="m9 6 6 6-6 6" /> : null}
      {name === "premium" ? <path d="M12 3.5 19 7v5c0 4.2-2.8 6.8-7 8.5-4.2-1.7-7-4.3-7-8.5V7z" /> : null}
      {name === "feed" ? <path d="M5 18a2 2 0 1 0 0.01 0M5 12a7 7 0 0 1 7 7M5 6a13 13 0 0 1 13 13" /> : null}
      {name === "news" ? (
        <>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </>
      ) : null}
    </svg>
  );
}
