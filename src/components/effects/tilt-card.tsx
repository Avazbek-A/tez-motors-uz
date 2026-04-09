"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glareEnabled?: boolean;
  scale?: number;
}

export function TiltCard({
  children,
  className = "",
  maxTilt = 10,
  glareEnabled = true,
  scale = 1.02,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [transform, setTransform] = useState("");
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({});
  const lastMoveRef = useRef(0);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) setIsMobile(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile) return;

      const now = Date.now();
      if (now - lastMoveRef.current < 16) return; // throttle ~60fps
      lastMoveRef.current = now;

      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -maxTilt;
      const rotateY = ((x - centerX) / centerX) * maxTilt;

      setTransform(
        `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`
      );

      if (glareEnabled) {
        const glareX = (x / rect.width) * 100;
        const glareY = (y / rect.height) * 100;
        setGlareStyle({
          background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(0, 212, 255, 0.15) 0%, transparent 60%)`,
        });
      }
    },
    [isMobile, maxTilt, scale, glareEnabled]
  );

  const handleMouseLeave = useCallback(() => {
    setTransform("");
    setGlareStyle({});
  }, []);

  if (isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={cardRef}
      className={cn("relative transition-transform duration-200 ease-out", className)}
      style={{ transform: transform || undefined, transformStyle: "preserve-3d" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {glareEnabled && (
        <div
          className="absolute inset-0 rounded-[inherit] pointer-events-none transition-opacity duration-200"
          style={glareStyle}
        />
      )}
    </div>
  );
}
