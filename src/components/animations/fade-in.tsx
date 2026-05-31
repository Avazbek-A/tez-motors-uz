"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FadeInScrollProps {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  className?: string;
  duration?: number;
}

export function FadeInScroll({
  children,
  delay = 0,
  direction = "up",
  className = "",
  duration = 0.8,
}: FadeInScrollProps) {
  const directionOffset = {
    up: { y: 40, x: 0 },
    down: { y: -40, x: 0 },
    left: { x: 40, y: 0 },
    right: { x: -40, y: 0 },
    none: { x: 0, y: 0 },
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        ...directionOffset[direction],
      }}
      whileInView={{
        opacity: 1,
        x: 0,
        y: 0,
      }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1], // cinematic Apple-like easing curve
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
