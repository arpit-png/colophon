"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export function FadeScrollArea({
  children,
  className = "",
  maxHeight = 320,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  maxHeight?: number;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(false);

  const syncFade = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setFadeTop(el.scrollTop > 6);
    setFadeBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 6);
  }, []);

  useEffect(() => {
    syncFade();
    const el = ref.current;
    if (!el) return;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncFade) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [syncFade, children]);

  return (
    <div
      className={`fade-scroll-wrap ${fadeTop ? "has-top" : ""} ${fadeBottom ? "has-bottom" : ""} ${className}`}
    >
      <div
        ref={ref}
        onScroll={syncFade}
        className="fade-scroll-inner"
        style={{ maxHeight }}
        role={ariaLabel ? "region" : undefined}
        aria-label={ariaLabel}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}
