"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const STAGGER = 0.03;

export function TextRoll({
  children,
  className = "",
  center = false,
}: {
  children: string;
  className?: string;
  center?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  const chars = children.split("");

  if (mounted && reduced) {
    return <span className={`text-roll ${className}`}>{children}</span>;
  }

  return (
    <motion.span
      initial="initial"
      whileHover="hovered"
      whileFocus="hovered"
      className={`text-roll ${className}`}
    >
      <span className="text-roll-row" aria-hidden="true">
        {chars.map((char, i) => {
          const delay = center ? STAGGER * Math.abs(i - (chars.length - 1) / 2) : STAGGER * i;
          return (
            <motion.span
              key={`top-${i}`}
              variants={{
                initial: { y: "0%" },
                hovered: { y: "-100%" },
              }}
              transition={{ ease: "easeInOut", delay, duration: 0.28 }}
              className="text-roll-char"
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          );
        })}
      </span>
      <span className="text-roll-row text-roll-row-alt" aria-hidden="true">
        {chars.map((char, i) => {
          const delay = center ? STAGGER * Math.abs(i - (chars.length - 1) / 2) : STAGGER * i;
          return (
            <motion.span
              key={`bot-${i}`}
              variants={{
                initial: { y: "100%" },
                hovered: { y: "0%" },
              }}
              transition={{ ease: "easeInOut", delay, duration: 0.28 }}
              className="text-roll-char"
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          );
        })}
      </span>
      <span className="sr">{children}</span>
    </motion.span>
  );
}
