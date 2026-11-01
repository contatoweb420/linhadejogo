import { headers } from "next/headers";
import type { Locale } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const value = (await headers()).get("x-site-locale")?.toLowerCase();
  if (value === "pt-pt") return "pt-PT";
  if (value === "en-us") return "en-US";
  return "pt-BR";
}
