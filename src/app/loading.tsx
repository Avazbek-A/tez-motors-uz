export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-5">
        <div className="w-14 h-14 rounded-xl border border-border flex items-center justify-center animate-pulse">
          {/* Tez Motors stepped-bars mark */}
          <svg width="30" height="30" viewBox="0 0 120 120" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="tez-load" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#eff3f7" />
                <stop offset="0.42" stopColor="#bfc9d6" />
                <stop offset="0.72" stopColor="#8995a6" />
                <stop offset="1" stopColor="#dae0e7" />
              </linearGradient>
            </defs>
            <path d="M27 34 H100 L93 46 H20 Z" fill="url(#tez-load)" />
            <path d="M27 54 H78 L71 66 H20 Z" fill="url(#tez-load)" />
            <path d="M27 74 H100 L93 86 H20 Z" fill="url(#tez-load)" />
          </svg>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
