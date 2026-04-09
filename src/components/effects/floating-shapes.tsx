"use client";

import { cn } from "@/lib/utils";

interface FloatingShapesProps {
  className?: string;
  count?: number;
}

const shapes = [
  { type: "circle", size: 60, color: "var(--neon-blue)", delay: "0s", duration: "8s", left: "10%", top: "20%" },
  { type: "hexagon", size: 40, color: "var(--neon-purple)", delay: "1s", duration: "10s", left: "80%", top: "15%" },
  { type: "triangle", size: 50, color: "var(--neon-pink)", delay: "2s", duration: "12s", left: "60%", top: "70%" },
  { type: "circle", size: 30, color: "var(--neon-green)", delay: "3s", duration: "9s", left: "25%", top: "80%" },
  { type: "hexagon", size: 70, color: "var(--neon-cyan)", delay: "0.5s", duration: "11s", left: "90%", top: "50%" },
  { type: "triangle", size: 35, color: "var(--neon-blue)", delay: "4s", duration: "7s", left: "5%", top: "55%" },
];

function ShapeElement({ type, size, color }: { type: string; size: number; color: string }) {
  if (type === "circle") {
    return (
      <div
        className="rounded-full"
        style={{
          width: size,
          height: size,
          border: `1px solid ${color}`,
          opacity: 0.1,
        }}
      />
    );
  }
  if (type === "triangle") {
    return (
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: `${size / 2}px solid transparent`,
          borderRight: `${size / 2}px solid transparent`,
          borderBottom: `${size}px solid ${color}`,
          opacity: 0.08,
        }}
      />
    );
  }
  // hexagon
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ opacity: 0.08 }}>
      <polygon
        points="50,3 95,25 95,75 50,97 5,75 5,25"
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
    </svg>
  );
}

export function FloatingShapes({ className = "", count = 6 }: FloatingShapesProps) {
  const activeShapes = shapes.slice(0, count);

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {activeShapes.map((shape, i) => (
        <div
          key={i}
          className="absolute animate-float"
          style={{
            left: shape.left,
            top: shape.top,
            animationDuration: shape.duration,
            animationDelay: shape.delay,
          }}
        >
          <ShapeElement type={shape.type} size={shape.size} color={shape.color} />
        </div>
      ))}
    </div>
  );
}
