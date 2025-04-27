'use client'; // Required for potential map display or data fetching on client

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Coordinates } from '@/types/maps'; // Assuming types are defined
import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'; // If showing map
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Camera, MapPin } from 'lucide-react';

// --- Interfaces (Should ideally be shared/imported) ---
interface Waypoint extends Coordinates {
  id: string;
  name?: string;
}

interface Photo {
  id: string;
  url: string;
  location: Coordinates;
  description?: string;
}

interface RouteData {
  id: string;
  name: string;
  waypoints: Waypoint[];
  photos: Photo[];
  // directions?: google.maps.DirectionsResult | null; // Optional
}

// --- Mock Fetch Function (Replace with actual Firebase fetch) ---
async function fetchRouteData(routeId: string): Promise<RouteData | null> {
  console.log(`Fetching route data for ID: ${routeId}`);
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // In a real app:
  // 1. Connect to Firebase Firestore.
  // 2. Get the document from the 'routes' collection with the matching routeId.
  // 3. Handle cases where the route doesn't exist (return null).
  // 4. Return the data.

  // --- Mock Data ---
  if (routeId.startsWith('route-')) { // Basic check if it looks like our mock ID
    return {
      id: routeId,
      name: "Mock Scenic Coastal Drive",
      waypoints: [
        { id: 'wp-1', lat: 37.7749, lng: -122.4194, name: 'Start: San Francisco' },
        { id: 'wp-2', lat: 37.8270, lng: -122.4230, name: 'Alcatraz Viewpoint' },
        { id: 'wp-3', lat: 37.8199, lng: -122.4783, name: 'Golden Gate Bridge' },
        { id: 'wp-4', lat: 37.7588, lng: -122.5134, name: 'End: Ocean Beach' },
      ],
      photos: [
        { id: 'ph-1', url: 'https://picsum.photos/seed/alcatraz/300/200', location: { lat: 37.8270, lng: -122.4230 }, description: 'View of Alcatraz Island' },
        { id: 'ph-2', url: 'https://picsum.photos/seed/ggbridge/300/200', location: { lat: 37.8199, lng: -122.4783 }, description: 'The iconic Golden Gate' },
      ],
    };
  } else {
    return null; // Route not found
  }
  // --- End Mock Data ---
}

// --- Component ---
export default function ViewRoutePage() {
  const params = useParams();
  const routeId = params.routeId as string;
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routeId) return;

    setLoading(true);
    setError(null);
    fetchRouteData(routeId)
      .then(data => {
        if (data) {
          setRouteData(data);
        } else {
          setError('Route not found.');
        }
      })
      .catch(err => {
        console.error("Error fetching route:", err);
        setError('Failed to load route data.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [routeId]);

  // --- Render Logic ---

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-64 w-full" /> {/* Placeholder for map */}
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
             <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return <div className="container mx-auto p-4 text-center text-destructive">{error}</div>;
  }

  if (!routeData) {
    // Should be covered by error state, but as a fallback
    return <div className="container mx-auto p-4 text-center">Route data could not be loaded.</div>;
  }

   // Calculate map bounds or center
  const mapCenter = routeData.waypoints.length > 0
    ? routeData.waypoints[0] // Center on the first waypoint
    : { lat: 0, lng: 0 }; // Default center if no waypoints

  return (
    <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>{routeData.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 w-full rounded-lg overflow-hidden mb-4 shadow-md">
              <Map
                  mapId={`view_map_${routeId}`}
                  defaultCenter={mapCenter}
                  defaultZoom={10} // Adjust zoom as needed
                  gestureHandling={'greedy'}
                  disableDefaultUI={true}
                  className="w-full h-full"
              >
                  {/* Waypoint Markers */}
                  {routeData.waypoints.map((waypoint, index) => (
                  <AdvancedMarker key={waypoint.id} position={waypoint}>
                      <Pin background={'hsl(var(--primary))'} glyphColor={'#fff'} borderColor={'#fff'}>
                          <span className="text-xs font-bold">{index + 1}</span>
                      </Pin>
                  </AdvancedMarker>
                  ))}
                   {/* Photo Markers */}
                  {routeData.photos.map((photo) => (
                    <AdvancedMarker key={photo.id} position={photo.location}>
                        <div className="p-1 bg-accent rounded-full shadow cursor-pointer">
                           <Camera className="w-4 h-4 text-accent-foreground" />
                        </div>
                    </AdvancedMarker>
                  ))}
                  {/* Consider adding DirectionsRenderer if directions data is stored/fetched */}
              </Map>
          </div>
          {/* Optionally display turn-by-turn directions if available */}
        </CardContent>
      </Card>

      <div className="space-y-4">
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary"/> Waypoints</CardTitle>
            </CardHeader>
             <CardContent>
                <ul className="space-y-2">
                {routeData.waypoints.map((wp, index) => (
                    <li key={wp.id} className="flex items-center gap-2 text-sm p-2 bg-secondary/30 rounded-md">
                        <span className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</span>
                        <span className="truncate" title={wp.name || `Waypoint ${index + 1}`}>{wp.name || `Waypoint ${index + 1}`}</span>
                    </li>
                ))}
                </ul>
             </CardContent>
         </Card>
         <Card>
             <CardHeader>
                <CardTitle className="flex items-center gap-2"><Camera className="w-5 h-5 text-accent"/> Photos</CardTitle>
            </CardHeader>
            <CardContent>
                {routeData.photos.length === 0 ? (
                     <p className="text-sm text-muted-foreground">No photos added to this route yet.</p>
                ) : (
                <div className="grid grid-cols-2 gap-2">
                    {routeData.photos.map(photo => (
                    <div key={photo.id} className="group relative">
                         <Image
                            src={photo.url}
                            alt={photo.description || 'Route photo'}
                            width={150}
                            height={100}
                            className="rounded-md object-cover w-full h-24"
                        />
                         {photo.description && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-b-md">
                                {photo.description}
                            </div>
                        )}
                    </div>
                    ))}
                </div>
                 )}
             </CardContent>
         </Card>
      </div>

    </div>
  );
}
