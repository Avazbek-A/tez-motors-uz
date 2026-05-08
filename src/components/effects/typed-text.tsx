"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useReducedEffects } from "@/hooks/use-reduced-effects";

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
  const reduced = useReducedEffects();

  useEffect(() => {
    // Mobile / reduced-motion: render the first tagline static. Saves
    // ~30 setTimeout/setState cycles per minute.
    if (reduced) {
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
  }, [texts, speed, deleteSpeed, pauseTime, isDeleting, reduced]);

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
