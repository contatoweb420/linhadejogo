import Image from "next/image";
import mark from "../../public/logo-nova.png";
import primaryMark from "../../public/marca/linha-de-jogo-cabecalho.png";

export function BrandMark({ compact = false, primary = false }: { compact?: boolean; primary?: boolean }) {
  if (primary) return (
    <span style={{ display: "block", position: "relative", width: "100%", aspectRatio: "1088 / 256", overflow: "hidden" }}>
      <Image src={primaryMark} alt="Linha de Jogo" width={1088} height={1088} unoptimized
        style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", width: "100%", height: "auto" }} />
    </span>
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
