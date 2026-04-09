"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TypedTextProps {
  texts: string[];
  speed?: number;
  deleteSpeed?: number;
  pauseTime?: number;
  className?: string;
  cursorColor?: string;
}

export function TypedText({
  texts,
  speed = 80,
  deleteSpeed = 40,
  pauseTime = 2000,
  className = "",
  cursorColor = "var(--neon-blue)",
}: TypedTextProps) {
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const textIndexRef = useRef(0);
  const charIndexRef = useRef(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setDisplayText(texts[0] || "");
      return;
    }

    const type = () => {
      const currentText = texts[textIndexRef.current];
      if (!currentText) return;

      if (!isDeleting) {
        if (charIndexRef.current < currentText.length) {
          charIndexRef.current++;
          setDisplayText(currentText.slice(0, charIndexRef.current));
          return speed + Math.random() * 40;
        } else {
          setIsDeleting(true);
          return pauseTime;
        }
      } else {
        if (charIndexRef.current > 0) {
          charIndexRef.current--;
          setDisplayText(currentText.slice(0, charIndexRef.current));
          return deleteSpeed;
        } else {
          setIsDeleting(false);
          textIndexRef.current = (textIndexRef.current + 1) % texts.length;
          return speed;
        }
      }
    };

    let timeout: NodeJS.Timeout;
    const tick = () => {
      const delay = type();
      if (delay !== undefined) {
        timeout = setTimeout(tick, delay);
      }
    };
    tick();

    return () => clearTimeout(timeout);
  }, [texts, speed, deleteSpeed, pauseTime, isDeleting]);

  return (
    <span className={cn("font-mono", className)}>
      {displayText}
      <span
        className="inline-block w-[2px] h-[1em] ml-1 align-middle animate-[blink-cursor_1s_step-end_infinite]"
        style={{ backgroundColor: cursorColor }}
      />
    </span>
  );
}
