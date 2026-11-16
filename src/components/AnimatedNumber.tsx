"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useMotionValue, useReducedMotion } from "framer-motion";

export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.4 });
  const reduced = useReducedMotion();
  const motionVal = useMotionValue(0);
  const [display, setDisplay] = useState<string>(() =>
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString("en-US"),
  );

  useEffect(() => {
    const format = (n: number) =>
      decimals > 0
        ? n.toFixed(decimals)
        : new Intl.NumberFormat("en-US").format(Math.round(n));

    if (reduced) {
      setDisplay(format(value));
      return;
    }

    if (!inView) {
      motionVal.set(0);
      return;
    }

    const controls = animate(motionVal, value, {
      duration: 0.85,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (latest) => setDisplay(format(latest)),
    });

    return () => controls.stop();
  }, [value, decimals, inView, reduced, motionVal]);

  return (
    <span ref={ref} className={`anim-num ${className}`}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
