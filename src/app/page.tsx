
import { RoutePlanner } from "@/components/route-planner"; // Correct named import with alias
import Map from "@/components/map"; // Keep Map component for potential global script loading logic

export default function Home() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // We render RoutePlanner within the layout which has the APIProvider.
  // The API key check is handled inside RootLayout.
  // If API key is missing, RootLayout shows an error message.
  // If API key is present, APIProvider wraps the children, including RoutePlanner.

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-6 lg:p-8"> {/* Adjusted padding */}
      {/* Render RoutePlanner directly. The APIProvider context is available from the layout. */}
       <RoutePlanner />

      {/* Map component might still be useful if it handles complex script loading scenarios,
          but if APIProvider handles it sufficiently, this might become redundant.
          Let's keep it for now, assuming it might have other roles later.
          Ensure it doesn't conflict with APIProvider's loading. */}
      {apiKey && <Map apiKey={apiKey} />}
    </main>
  );
}

    