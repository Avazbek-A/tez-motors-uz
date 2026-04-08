import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center px-6">
        <div className="w-24 h-24 rounded-full bg-navy/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl font-bold text-navy">404</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Page Not Found</h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-12 px-8 bg-lime text-navy font-semibold rounded-xl hover:bg-lime-dark transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
