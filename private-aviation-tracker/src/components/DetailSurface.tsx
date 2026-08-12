"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mobile bottom sheet.
 *
 * On a phone the map *is* the interface, so a desktop side panel is wrong
 * twice over: it covers the thing the user is looking at, and it puts content
 * at the top of a screen held at the bottom. A sheet keeps the map visible
 * above it, snaps to a peek height that shows the headline without hiding the
 * aircraft, and expands with a drag when the user wants the detail.
 *
 * Three snap points rather than open/closed. The peek state is what makes the
 * sheet usable one-handed: enough to identify the aircraft and see it move,
 * without committing the whole screen.
 */

type Snap = "peek" | "half" | "full";

const SNAP_VH: Record<Snap, number> = { peek: 22, half: 55, full: 92 };
const ORDER: Snap[] = ["peek", "half", "full"];

/**
 * Responsive detail surface: a dragging bottom sheet on phones, the familiar
 * side panel from desktop width up. The content is written once and rendered
 * into whichever container the viewport calls for, so the two can never drift
 * apart.
 */
export default function DetailSurface({
  open,
  onClose,
  children,
  initial = "half",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  initial?: Snap;
}) {
  const [snap, setSnap] = useState<Snap>(initial);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStart = useRef<{ y: number; time: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSnap(initial);
  }, [open, initial]);

  // Escape closes, matching the desktop panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const settle = useCallback(
    (deltaY: number, elapsed: number) => {
      const index = ORDER.indexOf(snap);
      // A quick flick moves one detent regardless of distance; a slow drag
      // needs to actually travel. Without the velocity test, a fast swipe that
      // covers little distance feels ignored.
      const velocity = deltaY / Math.max(1, elapsed);
      const flick = Math.abs(velocity) > 0.5;
      const travelled = Math.abs(deltaY) > window.innerHeight * 0.08;

      if (!flick && !travelled) {
        setDragOffset(0);
        return;
      }

      if (deltaY > 0) {
        // Downward: collapse, and close if already at the smallest detent.
        if (index === 0) onClose();
        else setSnap(ORDER[index - 1]);
      } else if (index < ORDER.length - 1) {
        setSnap(ORDER[index + 1]);
      }
      setDragOffset(0);
    },
    [snap, onClose],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = { y: e.clientY, time: Date.now() };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const delta = e.clientY - dragStart.current.y;
    // Resist upward drag past the tallest detent rather than allowing the
    // sheet to leave the screen.
    setDragOffset(snap === "full" && delta < 0 ? delta * 0.25 : delta);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    settle(e.clientY - dragStart.current.y, Date.now() - dragStart.current.time);
    dragStart.current = null;
  };

  if (!open) return null;

  const height = `calc(${SNAP_VH[snap]}dvh + env(safe-area-inset-bottom, 0px))`;

  return (
    <>
      {/* Desktop / iPad landscape: the side panel. */}
      <aside className="animate-panel-in panel-scroll pointer-events-auto absolute right-0 top-0 z-20 hidden h-full w-[420px] flex-col overflow-y-auto border-l border-edge bg-panel/95 backdrop-blur-md md:flex">
        {children}
      </aside>

      {/* Phone: a sheet that leaves the map visible above it. */}
      <div
      className="animate-sheet-in glass-panel fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-b-none border-b-0 md:hidden"
      style={{
        height,
        transform: `translateY(${Math.max(0, dragOffset)}px)`,
        transition: dragStart.current ? "none" : "height 280ms cubic-bezier(0.32,0.72,0,1), transform 280ms cubic-bezier(0.32,0.72,0,1)",
      }}
      role="dialog"
      aria-modal="false"
      data-detail-sheet="true"
    >
      {/* Generous grab area: a 4px bar alone is a miss target one-handed. */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="shrink-0 cursor-grab touch-none select-none py-2.5 active:cursor-grabbing"
      >
        <div className="mx-auto h-1 w-9 rounded-full bg-edge-2" aria-hidden />
      </div>

      <div
        ref={scrollRef}
        className="sheet-scroll panel-scroll min-h-0 flex-1 overflow-y-auto pad-bottom-safe"
      >
        {children}
      </div>
      </div>
    </>
  );
}
