
import { RoutePlanner } from "@/components/route-planner"; // Correct named import with alias

export default function Home() {
  // The API key check and APIProvider setup are handled in the RootLayout.
  // RoutePlanner will be rendered within the context provided by APIProvider.

  return (
    <main className="flex flex-1 flex-col items-center justify-between p-4 md:p-6 lg:p-8"> {/* Use flex-1 to allow content to grow */}
      {/* Render RoutePlanner directly. The APIProvider context is available from the layout. */}
       <RoutePlanner />

      {/* The custom Map component (src/components/map.tsx) is no longer needed
          as APIProvider handles script loading. Removed its import and usage. */}
    </main>
  );
}
