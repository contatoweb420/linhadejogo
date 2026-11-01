import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/redacao/", "/api/"] },
    sitemap: base ? new URL("/sitemap.xml", base).toString() : undefined,
  };
}
