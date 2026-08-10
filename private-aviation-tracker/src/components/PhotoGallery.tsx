"use client";

import { useState } from "react";
import { Divider, EmptyNote, SectionTitle, Spinner } from "@/components/ui";
import type { AircraftPhoto } from "@/lib/types";

/**
 * Photo gallery.
 *
 * Images are hot-linked from wherever they are published and every one carries
 * its credit and a link back to the page it came from — nothing is copied or
 * re-hosted. A thumbnail that fails to load is dropped rather than left as a
 * broken frame, since a dead image is worse than one fewer photo.
 */
export default function PhotoGallery({
  photos,
  loading,
  note,
}: {
  photos: AircraftPhoto[];
  loading: boolean;
  note?: string | null;
}) {
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(new Set());

  const usable = photos.filter((p) => !broken.has(p.url));
  const current = usable[Math.min(active, usable.length - 1)] ?? null;

  return (
    <>
      <Divider />
      <section>
        <SectionTitle>
          Photos{usable.length > 1 ? ` · ${usable.length}` : ""}
        </SectionTitle>

        {loading && usable.length === 0 && <Spinner label="Searching for photographs…" />}

        {!loading && usable.length === 0 && (
          <EmptyNote>
            {note ?? "No public photographs were found for this registration."}
          </EmptyNote>
        )}

        {current && (
          <div className="px-4 pb-4">
            {current.verified ? (
              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-sm border border-lime/40 bg-lime/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-lime">
                verified aircraft photo
              </div>
            ) : (
              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-sm border border-amber/40 bg-amber/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber">
                aircraft type reference — not confirmed as this airframe
              </div>
            )}
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt="Aircraft photograph"
                className="h-48 w-full rounded-sm border border-edge object-cover"
                loading="lazy"
                onError={() => setBroken((prev) => new Set(prev).add(current.url))}
              />
              <figcaption className="mt-1.5 text-[10px] leading-relaxed text-ink-3">
                {current.link ? (
                  <a
                    href={current.link}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="hover:text-cyan"
                  >
                    {current.credit ?? "View source"} ↗
                  </a>
                ) : (
                  current.credit
                )}
              </figcaption>
            </figure>

            {usable.length > 1 && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {usable.map((photo, index) => (
                  <button
                    key={photo.url}
                    type="button"
                    onClick={() => setActive(index)}
                    className={`h-12 w-16 shrink-0 overflow-hidden rounded-sm border transition-colors ${
                      photo.url === current.url
                        ? "border-cyan"
                        : "border-edge hover:border-edge-2"
                    }`}
                    aria-label={`Photo ${index + 1}${photo.verified ? " (verified)" : " (type reference)"}`}
                    title={
                      photo.verified
                        ? "Confirmed photograph of this registration"
                        : "Same aircraft type — not confirmed as this airframe"
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnailUrl ?? photo.url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={() => setBroken((prev) => new Set(prev).add(photo.url))}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
