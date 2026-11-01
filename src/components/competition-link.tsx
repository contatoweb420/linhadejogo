import Link from "next/link";
import { Crest } from "@/components/crest";

export function CompetitionLink({
  href,
  name,
  emblemUrl,
  detail,
  meta,
}: {
  href: string;
  name: string;
  emblemUrl: string | null;
  detail: string;
  meta?: string;
}) {
  return (
    <Link
      href={href}
      title={name}
      className={`grid h-[6.5rem] items-center gap-3 border border-line bg-card px-3 text-sm hover:bg-raised ${meta ? "grid-cols-[2.5rem_minmax(0,1fr)_auto]" : "grid-cols-[2.5rem_minmax(0,1fr)]"}`}
    >
      <Crest src={emblemUrl} name={name} size="md" />
      <span className="grid min-w-0 grid-rows-[2.5rem_1rem] content-center gap-0.5">
        <span className="line-clamp-2 self-end font-medium leading-5">{name}</span>
        <span className="truncate text-xs leading-4 text-muted">{detail}</span>
      </span>
      {meta ? <span className="shrink-0 text-xs text-muted">{meta}</span> : null}
    </Link>
  );
}
