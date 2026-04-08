"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center px-6">
        <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">!</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Something went wrong</h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          An unexpected error has occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center h-12 px-8 bg-navy text-white font-semibold rounded-xl hover:bg-navy-light transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
