import Link from "@/components/localized-link";
import Image from "next/image";
import type { ArticleImage } from "@/server/images/providers";

export function EditorialImage({ image, preview = false, href, priority = false }: { image: ArticleImage; preview?: boolean; href?: string; priority?: boolean }) {
  const photo = (
    <div className="relative aspect-[16/9] overflow-hidden bg-raised">
      <Image src={image.imageUrl} alt={image.alt} fill priority={priority} sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
    </div>
  );
  return (
    <figure className="grid gap-2">
      {href ? <Link href={href} aria-label={image.alt}>{photo}</Link> : photo}
      <figcaption className="text-xs text-muted">
        {image.provider === "local-ai" ? image.caption : <>
        {image.caption ?? image.alt} · Foto: <a className="underline" href={image.creditUrl} rel="noreferrer">{image.credit}</a>
        {" · "}<a className="underline" href={image.licenseUrl} rel="noreferrer">{image.license}</a>
        {" · "}<a className="underline" href={image.sourceUrl} rel="noreferrer">Origem</a>
        {preview ? ` · Licença verificada em ${new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Lisbon" }).format(new Date(image.checkedAt))}` : ""}
        </>}
      </figcaption>
    </figure>
  );
}
