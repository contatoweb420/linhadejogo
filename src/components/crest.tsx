"use client";

import { useState } from "react";
import Image from "next/image";

const crestBox = {
  sm: { frame: "h-8 w-8", image: "h-7 w-7", pixels: 28 },
  md: { frame: "h-10 w-10", image: "h-9 w-9", pixels: 36 },
} as const;

export function Crest({ src, name, size = "sm" }: { src: string | null; name: string; size?: keyof typeof crestBox }) {
  const box = crestBox[size];
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Initials name={name} frame={box.frame} />;

  const plate = needsLightPlate(src, name);

  return (
    <span className={`inline-grid shrink-0 place-items-center ${box.frame} ${plate ? "bg-[var(--plate)]" : ""}`}>
      <Image
        src={src}
        alt=""
        width={box.pixels}
        height={box.pixels}
        className={`${box.image} object-contain`}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

const LIGHT_PLATE = /\/(CL|PL|ED)\.(png|svg|jpe?g|webp)(\?|$)/i;
const LIGHT_PLATE_NAMES = new Set(["UEFA Champions League", "Premier League", "Eredivisie"]);

function needsLightPlate(src: string, name: string) {
  return LIGHT_PLATE.test(src) || LIGHT_PLATE_NAMES.has(name);
}

function Initials({ name, frame }: { name: string; frame: string }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center bg-raised font-serif text-sm text-foreground ${frame}`}>
      {name.slice(0, 2).toLocaleUpperCase("pt-PT")}
    </span>
  );
}
