"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

const SPRING = {
  mass: 0.12,
  damping: 14,
  stiffness: 150,
};

export function SpringCursorGlow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);
  const x = useMotionValue(-120);
  const y = useMotionValue(-120);
  const xSpring = useSpring(x, SPRING);
  const ySpring = useSpring(y, SPRING);
  const opacitySpring = useSpring(0, SPRING);
  const scaleSpring = useSpring(0.6, SPRING);

  return (
    <div
      className={`cursor-glow-area ${className}`}
      onPointerMove={(e) => {
        if (reduced || e.pointerType === "touch") return;
        const bounds = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - bounds.left);
        y.set(e.clientY - bounds.top);
      }}
      onPointerEnter={(e) => {
        if (reduced || e.pointerType === "touch") return;
        opacitySpring.set(1);
        scaleSpring.set(1);
      }}
      onPointerLeave={() => {
        opacitySpring.set(0);
        scaleSpring.set(0.6);
      }}
    >
      {(!mounted || !reduced) && (
        <motion.span
          aria-hidden="true"
          className="cursor-glow-orb"
          style={{
            x: xSpring,
            y: ySpring,
            opacity: opacitySpring,
            scale: scaleSpring,
          }}
        />
      )}
      {children}
    </div>
  );
}
