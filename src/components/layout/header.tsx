import React from "react";
import { Map } from "lucide-react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "../ui/button";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <Map className="h-6 w-6 text-primary" />
          <span className="font-bold">RouteSnap</span>
        </Link>
        <div className="ml-auto">{session && (
          <Button onClick={() => signOut()}>Sign out</Button>
        )}
        </div>
        {/* Add navigation items here if needed */}
      </div>
    </header>
  );
}

