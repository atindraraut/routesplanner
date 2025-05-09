
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { RoutePlanner } from "@/components/route-planner";

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  return (
    <main className="flex flex-1 flex-col items-center justify-between p-4 md:p-6 lg:p-8">
      {status === "unauthenticated" && <div>Unauthorized</div>}
      {status === "authenticated" && <RoutePlanner />}
       
    </main>
  );
}
