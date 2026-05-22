import { Link } from "wouter";
import { Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";

function PublicNav() {
  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-[hsl(221,83%,35%)]">
          <Anchor className="h-5 w-5" />
          Vantage
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/pricing" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 font-medium">
            Pricing
          </Link>
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-sm">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="text-sm">
              Get started
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function PublicFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <Anchor className="h-5 w-5 text-[hsl(221,83%,55%)]" />
            Vantage
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <a href="mailto:hello@vantage.com" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="text-sm">
            <Link href="/signup">
              <Button size="sm" className="bg-[hsl(221,83%,35%)] hover:bg-[hsl(221,83%,30%)] text-white text-sm">
                Start free
              </Button>
            </Link>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-800 text-xs text-center text-gray-600">
          © {new Date().getFullYear()} Vantage. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicNav />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
