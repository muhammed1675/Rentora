import { Link } from 'react-router-dom';
import { Home, ArrowRight, Search, HelpCircle } from 'lucide-react';

export function NotFound() {
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-5 py-20">
      <div className="mx-auto max-w-2xl w-full">
        {/* Header Section */}
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Error 404</p>
          <h1 className="mt-4 text-6xl font-bold tracking-[-0.045em] text-foreground sm:text-7xl md:text-8xl">
            Page Not Found
          </h1>
        </div>

        {/* Description */}
        <p className="mt-6 text-center text-base leading-7 text-muted-foreground max-w-xl mx-auto">
          We couldn&apos;t find the page you&apos;re looking for. It might have been moved, deleted, or maybe you followed a broken link. Let&apos;s get you back on track.
        </p>

        {/* Primary CTA Buttons */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
          >
            <Home className="h-4 w-4" />
            Go to Home
          </Link>
          <Link
            to="/browse"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/20 bg-white px-6 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            <Search className="h-4 w-4" />
            Browse Homes
          </Link>
        </div>

        {/* Quick Links Section */}
        <div className="mt-16 rounded-2xl bg-white p-8 border border-black/5">
          <div className="flex items-center gap-2 mb-6">
            <HelpCircle className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-foreground">Explore Other Pages</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Link to="/browse" className="group">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Browse Listings</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Explore verified homes for LAUTECH students</p>
            </Link>
            <Link to="/compare" className="group">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Compare Homes</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Side-by-side property comparison</p>
            </Link>
            <Link to="/contact" className="group">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Contact Us</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Get help from our support team</p>
            </Link>
          </div>
        </div>

        {/* Support Footer */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Need help? <Link to="/contact" className="text-primary font-medium hover:underline">Contact our support team</Link></p>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
