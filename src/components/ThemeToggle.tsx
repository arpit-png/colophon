"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";

export type ThemeMode = "light" | "dark";
export type TransitionVariant = "circle" | "circle-blur" | "rectangle" | "polygon";

function buildTransitionCss(variant: TransitionVariant): string {
  if (variant === "rectangle") {
    return `
      ::view-transition-group(root) { animation-duration: 0.65s; animation-timing-function: cubic-bezier(0.2, 0.7, 0.2, 1); }
      ::view-transition-new(root) { animation-name: co-reveal-rect; }
      ::view-transition-old(root) { animation: none; z-index: -1; }
      @keyframes co-reveal-rect {
        from { clip-path: polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%); }
        to { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); }
      }
    `;
  }
  if (variant === "polygon") {
    return `
      ::view-transition-group(root) { animation-duration: 0.65s; animation-timing-function: cubic-bezier(0.2, 0.7, 0.2, 1); }
      ::view-transition-new(root) { animation-name: co-reveal-poly; }
      ::view-transition-old(root) { animation: none; z-index: -1; }
      @keyframes co-reveal-poly {
        from { clip-path: polygon(100% 0%, 100% 0%, 100% 0%, 100% 0%); }
        to { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); }
      }
    `;
  }
  if (variant === "circle-blur") {
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><filter id="b"><feGaussianBlur stdDeviation="2"/></filter></defs><circle cx="40" cy="0" r="18" fill="white" filter="url(#b)"/></svg>`,
    );
    return `
      ::view-transition-group(root) { animation-timing-function: cubic-bezier(0.2, 0.7, 0.2, 1); }
      ::view-transition-new(root) {
        mask: url("data:image/svg+xml,${svg}") top right / 0 no-repeat;
        animation: co-scale-blur 0.85s forwards;
      }
      ::view-transition-old(root) { animation: none; z-index: -1; }
      @keyframes co-scale-blur { to { mask-size: 350vmax; } }
    `;
  }
  return `
    ::view-transition-group(root) { animation-duration: 0.7s; animation-timing-function: cubic-bezier(0.2, 0.7, 0.2, 1); }
    ::view-transition-new(root) { animation-name: co-reveal-circle; }
    ::view-transition-old(root) { animation: none; z-index: -1; }
    @keyframes co-reveal-circle {
      from { clip-path: circle(0% at 92% 4%); }
      to { clip-path: circle(150% at 92% 4%); }
    }
  `;
}

export function useColophonTheme(variant: TransitionVariant = "circle") {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("colophon.theme");
    const initial: ThemeMode = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const applyTheme = useCallback((next: ThemeMode) => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("colophon.theme", next);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = theme === "light" ? "dark" : "light";

    let styleEl = document.getElementById("colophon-theme-transition") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "colophon-theme-transition";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = buildTransitionCss(variant);

    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => void;
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof doc.startViewTransition === "function" && !reduced) {
      doc.startViewTransition(() => applyTheme(next));
    } else {
      applyTheme(next);
    }
  }, [theme, variant, applyTheme]);

  return { theme, toggleTheme };
}

export function ThemeToggleButton({
  theme,
  onToggle,
}: {
  theme: ThemeMode;
  onToggle: () => void;
}) {
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${isLight ? "Nocturnal Reading Room dark" : "Archival Paper light"} theme`}
      title={`Theme: ${isLight ? "Archival Paper" : "Nocturnal"}`}
      className="icon-btn theme-toggle-btn"
    >
      <svg viewBox="0 0 240 240" fill="none" className="theme-toggle-svg" aria-hidden="true">
        <motion.g
          animate={{ rotate: isLight ? 0 : 180 }}
          transition={{ ease: "easeInOut", duration: 0.45 }}
          style={{ originX: "120px", originY: "120px" }}
        >
          <path
            d="M120 67.5C149.25 67.5 172.5 90.75 172.5 120C172.5 149.25 149.25 172.5 120 172.5"
            fill="currentColor"
          />
          <path
            d="M120 67.5C90.75 67.5 67.5 90.75 67.5 120C67.5 149.25 90.75 172.5 120 172.5"
            fill="var(--paper)"
          />
        </motion.g>
        <motion.path
          animate={{ rotate: isLight ? 0 : -180 }}
          transition={{ ease: "easeInOut", duration: 0.45 }}
          style={{ originX: "120px", originY: "120px" }}
          d="M120 3.75C55.5 3.75 3.75 55.5 3.75 120C3.75 184.5 55.5 236.25 120 236.25C184.5 236.25 236.25 184.5 236.25 120C236.25 55.5 184.5 3.75 120 3.75ZM120 214.5V172.5C90.75 172.5 67.5 149.25 67.5 120C67.5 90.75 90.75 67.5 120 67.5V25.5C172.5 25.5 214.5 67.5 214.5 120C214.5 172.5 172.5 214.5 120 214.5Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
