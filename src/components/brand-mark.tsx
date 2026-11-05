import Image from "next/image";
import mark from "../../public/logo-nova.png";

export function BrandMark({ compact = false }: { compact?: boolean }) {
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
