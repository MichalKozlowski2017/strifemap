"use client";

import { useState } from "react";

/**
 * Real photo only. With `required`, hide entirely if URL missing/fails
 * (parent should already filter missing URLs).
 */
export function NewsImage({
  src,
  alt,
  className = "",
  aspect = "video",
  required = false,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  aspect?: "video" | "square" | "wide";
  required?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const ratio =
    aspect === "wide"
      ? "aspect-[21/9]"
      : aspect === "square"
        ? "aspect-square"
        : "aspect-video";

  if (!src || failed) {
    if (required) return null;
    return (
      <div
        className={`${ratio} w-full bg-[var(--surface-2)] ${className}`}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${ratio} w-full object-cover ${className}`}
    />
  );
}
