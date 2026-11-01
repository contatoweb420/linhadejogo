export type SocialProfileLink = {
  label: string;
  href: string;
  icon: "instagram" | "tiktok";
};

export function getSocialProfileLinks(): SocialProfileLink[] {
  return [
    profile(process.env.NEXT_PUBLIC_INSTAGRAM_URL, "instagram.com", "Instagram", "instagram"),
    profile(process.env.NEXT_PUBLIC_TIKTOK_URL, "tiktok.com", "TikTok", "tiktok"),
  ].filter((link): link is SocialProfileLink => link !== null);
}

function profile(value: string | undefined, host: string, label: string, icon: SocialProfileLink["icon"]): SocialProfileLink | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || (url.hostname !== host && !url.hostname.endsWith(`.${host}`)) || !url.pathname.split("/").filter(Boolean).length) return null;
    return { label: `Linha de Jogo no ${label}`, href: url.toString(), icon };
  } catch {
    return null;
  }
}
