"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { TransitionVariant } from "@/components/ThemeToggle";

const VARIANTS: { id: TransitionVariant; label: string }[] = [
  { id: "circle", label: "Circle" },
  { id: "circle-blur", label: "Soft" },
  { id: "rectangle", label: "Swipe" },
  { id: "polygon", label: "Slice" },
];

export function DynamicStatusPill({
  blockHeight,
  chainOK,
  failedIndex,
  pendingCount,
  ready,
  variant,
  onVariantChange,
}: {
  blockHeight: number;
  chainOK: boolean;
  failedIndex?: number | null;
  pendingCount: number;
  ready: boolean;
  variant: TransitionVariant;
  onVariantChange: (v: TransitionVariant) => void;
}) {
  const [open, setOpen] = useState(false);

  const label = !ready
    ? "Syncing…"
    : chainOK
      ? `Block #${blockHeight} · Verified`
      : `Integrity failure · #${failedIndex ?? 0}`;

  const dotClass = !ready ? "dot" : chainOK ? "dot ok" : "dot bad";

  return (
    <motion.div
      layout
      className="dyn-pill-shell"
      animate={{ width: open ? 436 : 200 }}
      transition={{ type: "spring", bounce: 0.16, duration: 0.45 }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Toggle ledger telemetry & transition capsule"
        className="dyn-pill-trigger"
      >
        <span className={dotClass} aria-hidden="true" />
        <span className="dyn-pill-label mono">{label}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18 }}
            className="dyn-pill-drawer"
          >
            <span className="dyn-pill-stat mono" title="Pending transactions awaiting seal">
              {pendingCount} queued
            </span>
            <span className="dyn-pill-sep" aria-hidden="true" />
            <span className="dyn-pill-variants" role="group" aria-label="Theme reveal style">
              <Sparkles size={11} aria-hidden="true" className="dyn-pill-ico" />
              {VARIANTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onVariantChange(item.id)}
                  className={`dyn-var-btn${variant === item.id ? " active" : ""}`}
                >
                  {item.label}
                </button>
              ))}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
