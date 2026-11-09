"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLocale } from "./locale-context";
import { contentPath } from "@/lib/seo-path";

/** Resolve links during SSR as well as client navigation, using the layout locale. */
export default function LocalizedLink(props: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  const href = typeof props.href === "string" ? contentPath(props.href, locale) : {
    ...props.href,
    pathname: props.href.pathname ? contentPath(props.href.pathname, locale) : props.href.pathname,
  };
  return <NextLink {...props} href={href} />;
}
