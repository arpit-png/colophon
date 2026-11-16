"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

export function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`m-arrow ${className}`} aria-hidden="true">
      <ChevronRight className="m-arrow-head" size={16} />
      <span className="m-arrow-shaft" />
    </span>
  );
}

export function MenuIcon({
  open,
  onToggle,
  className = "",
}: {
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? "Close navigation drawer" : "Open navigation drawer"}
      className={`icon-btn m-menu-btn ${className}`}
    >
      <span className="m-menu-bars" aria-hidden="true">
        <motion.span
          animate={{ y: open ? 0 : -5, rotate: open ? 45 : 0 }}
          transition={{ duration: 0.22 }}
          className="m-menu-bar"
        />
        <motion.span
          animate={{ opacity: open ? 0 : 1 }}
          transition={{ duration: 0.12 }}
          className="m-menu-bar"
        />
        <motion.span
          animate={{ y: open ? 0 : 5, rotate: open ? -45 : 0 }}
          transition={{ duration: 0.22 }}
          className="m-menu-bar"
        />
      </span>
    </button>
  );
}

export function VolumeIcon({
  muted,
  onToggle,
  className = "",
}: {
  muted: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!muted}
      aria-label={muted ? "Unmute ledger audio cues" : "Mute ledger audio cues"}
      title={muted ? "Audio cues muted" : "Audio cues active"}
      className={`icon-btn m-vol-btn ${className}`}
    >
      <motion.span
        initial={false}
        className="m-vol-wrap"
        animate={{ rotate: muted ? [0, -15, 5, -2, 0] : 0 }}
        transition={{ duration: 0.35 }}
      >
        <svg viewBox="0 0 24 24" className="m-vol-svg" aria-hidden="true">
          <path
            fill="currentColor"
            d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"
          />
          <path
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            stroke="currentColor"
            d="M16 9a5 5 0 0 1 0 6"
          />
          <path
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            stroke="currentColor"
            d="M19.364 18.364a9 9 0 0 0 0-12.728"
          />
        </svg>
        <span className="m-vol-slash-box" aria-hidden="true">
          <motion.span
            initial={false}
            animate={{ scaleY: muted ? 1 : 0 }}
            transition={{
              ease: "easeInOut",
              duration: muted ? 0.14 : 0.08,
              delay: muted ? 0.12 : 0,
            }}
            style={{ transformOrigin: "top" }}
            className="m-vol-slash-outer"
          >
            <span className="m-vol-slash-inner" />
          </motion.span>
        </span>
      </motion.span>
    </button>
  );
}
