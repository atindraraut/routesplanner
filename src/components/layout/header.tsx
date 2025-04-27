import { Map } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <Map className="h-6 w-6 text-primary" />
          <span className="font-bold">RouteSnap</span>
        </Link>
        {/* Add navigation items here if needed */}
      </div>
    </header>
  );
}
