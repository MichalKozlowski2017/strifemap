"use client";

import { useState } from "react";

/** Real photo when URL works; quiet non-photo fallback otherwise. Never generates images. */
export function NewsImage({
  src,
  alt,
  className = "",
  aspect = "video",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  aspect?: "video" | "square" | "wide";
}) {
  const [failed, setFailed] = useState(false);
  const ratio =
    aspect === "wide"
      ? "aspect-[21/9]"
      : aspect === "square"
        ? "aspect-square"
        : "aspect-video";

  if (!src || failed) {
    return (
      <div
        className={`${ratio} w-full bg-[var(--surface-2)] ${className}`}
        aria-hidden
      >
        <div className="flex h-full w-full items-end p-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-2)]">
            —
          </span>
        </div>
      </div>
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
