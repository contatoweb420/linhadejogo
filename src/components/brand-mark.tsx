import Image from "next/image";
import mark from "../../public/logo-nova.png";
import primaryMark from "../../public/marca/linha-de-jogo-cabecalho-v4.png";

export function BrandMark({ compact = false, primary = false }: { compact?: boolean; primary?: boolean }) {
  if (primary) return (
    <Image
      src={primaryMark}
      alt="Linha de Jogo"
      width={2200}
      height={360}
      unoptimized
      style={{ display: "block", width: "100%", height: "auto", objectFit: "contain" }}
    />
  );
  const image = (
    <Image
      src={mark}
      width={2179}
      height={464}
      alt=""
      className={compact ? "brand-mark-compact" : "brand-mark-lockup"}
      sizes={compact ? "48px" : "(max-width: 767px) calc(100vw - 2rem), 13.5rem"}
    />
  );
  if (!compact) return image;
  return <span className="brand-mark-frame" aria-hidden="true">{image}</span>;
}
