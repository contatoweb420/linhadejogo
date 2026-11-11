import { FootballLoader } from "@/components/football-loader";
import { getLocale } from "@/lib/get-locale";
import { translate } from "@/lib/i18n";

export default async function Loading() {
  const locale = await getLocale();
  return <FootballLoader label={translate(locale, "A preparar as estatísticas.")} />;
}
