import Image from "next/image";
import type { ArticleImage } from "@/server/images/providers";

export function EditorialImage({ image, preview = false }: { image: ArticleImage; preview?: boolean }) {
  return (
    <figure className="grid gap-2">
      <div className="relative aspect-[16/9] overflow-hidden bg-raised">
        <Image src={image.imageUrl} alt={image.alt} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
        {image.provider === "local-ai" ? <span className="absolute bottom-3 left-3 rounded border border-accent bg-background px-3 py-1 text-xs font-semibold text-foreground">Ilustração gerada por IA</span> : null}
      </div>
      <figcaption className="text-xs text-muted">
        {image.provider === "local-ai" ? image.caption : <>
        {image.alt} · Foto: <a className="underline" href={image.creditUrl} rel="noreferrer">{image.credit}</a>
        {" · "}<a className="underline" href={image.licenseUrl} rel="noreferrer">{image.license}</a>
        {" · "}<a className="underline" href={image.sourceUrl} rel="noreferrer">Origem</a>
        {preview ? ` · Licença verificada em ${new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Lisbon" }).format(new Date(image.checkedAt))}` : ""}
        </>}
      </figcaption>
    </figure>
  );
}
