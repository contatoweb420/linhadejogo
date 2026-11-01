import { HudLoader } from "@/components/hud-loader";
import { getLocale } from "@/lib/get-locale";
import { translate } from "@/lib/i18n";

export default async function Loading() {
  const locale = await getLocale();
  return <HudLoader variant="compact" label={translate(locale, "A preparar as estatísticas.")} />;
}
