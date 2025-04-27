import { RoutePlanner } from "../components/route-planner"; // Use named import
import Map from "../components/map";

export default function Home() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-8 lg:p-24"> {/* Adjust padding for responsiveness */}
      {/* Render RoutePlanner only if API key is available, or handle the error state */}
      {apiKey ? (
        <RoutePlanner />
      ) : (
         <div className="text-destructive text-center">
            Google Maps API Key is missing. Cannot load planner.
         </div>
      )}
      {/* Map component is only responsible for loading the script, not rendering the map itself */}
      {/* Map rendering is handled within RoutePlanner and ViewRoutePage */}
      {apiKey && <Map apiKey={apiKey} />}
    </main>
  );
}
