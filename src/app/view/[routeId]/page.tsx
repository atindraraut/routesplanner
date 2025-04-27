
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Coordinates } from '@/types/maps';
import { Map, AdvancedMarker, Pin, useMapsLibrary, useMap } from '@vis.gl/react-google-maps';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Camera, MapPin, LocateFixed, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button'; // If needed for future interactions

// --- Interfaces (Should ideally be shared/imported) ---
interface Waypoint extends Coordinates {
  id: string;
  name?: string;
  address?: string;
}

interface Photo {
  id: string;
  url: string;
  location: Coordinates;
  waypointId?: string; // Link photo to a waypoint (Origin, Dest, or Intermediate ID)
  description?: string;
}

// Matches the structure used in RoutePlanner for saving/fetching
interface StoredRouteData {
  id: string;
  name: string;
  origin: Waypoint;
  destination: Waypoint;
  intermediateWaypoints: Waypoint[];
  photos: Photo[];
  // directionsResultJson?: string; // Optional
}

// --- Mock Fetch Function (Replace with actual Firebase fetch) ---
async function fetchRouteData(routeId: string): Promise<StoredRouteData | null> {
  console.log(`Fetching route data for ID: ${routeId}`);
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // In a real app: Fetch from Firestore 'routes' collection by routeId.
  // Handle not found cases.

  // --- Mock Data (Updated structure) ---
  if (routeId.startsWith('route-')) {
    return {
      id: routeId,
      name: "Mock Scenic Coastal Drive",
      origin: { id: 'wp-origin', lat: 37.7749, lng: -122.4194, name: 'Civic Center Plaza', address: 'San Francisco, CA, USA' },
      destination: { id: 'wp-dest', lat: 37.7588, lng: -122.5134, name: 'Ocean Beach', address: 'Great Hwy, San Francisco, CA, USA' },
      intermediateWaypoints: [
        { id: 'wp-inter-1', lat: 37.8270, lng: -122.4230, name: 'Alcatraz Viewpoint', address: 'Pier 39 Area, SF' },
        { id: 'wp-inter-2', lat: 37.8199, lng: -122.4783, name: 'Golden Gate Bridge Vista Point', address: 'Near Golden Gate Bridge, SF' },
      ],
      photos: [
        { id: 'ph-1', url: 'https://picsum.photos/seed/alcatraz/300/200', location: { lat: 37.8270, lng: -122.4230 }, waypointId: 'wp-inter-1', description: 'View of Alcatraz Island' },
        { id: 'ph-2', url: 'https://picsum.photos/seed/ggbridge/300/200', location: { lat: 37.8199, lng: -122.4783 }, waypointId: 'wp-inter-2', description: 'The iconic Golden Gate' },
        { id: 'ph-3', url: 'https://picsum.photos/seed/oceanbeach/300/200', location: { lat: 37.7588, lng: -122.5134 }, waypointId: 'wp-dest', description: 'Waves at Ocean Beach' },
      ],
    };
  } else {
    return null; // Route not found
  }
  // --- End Mock Data ---
}


// --- View Route Map Component ---
// Extracted to handle map-specific logic and hooks
function ViewRouteMap({ routeData }: { routeData: StoredRouteData }) {
    const map = useMap();
    const routesLib = useMapsLibrary('routes');
    const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
    const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
    const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null); // Store the result

     // Initialize Directions Service and Renderer
    useEffect(() => {
        if (!routesLib || !map) return;
        setDirectionsService(new routesLib.DirectionsService());
        setDirectionsRenderer(new routesLib.DirectionsRenderer({
             map,
             suppressMarkers: true, // We use AdvancedMarkers
              polylineOptions: {
                strokeColor: 'hsl(var(--primary))',
                strokeOpacity: 0.8,
                strokeWeight: 6,
            }
         }));
    }, [routesLib, map]);


      // Calculate and Render Directions
    useEffect(() => {
        if (!directionsService || !directionsRenderer || !routeData.origin || !routeData.destination) {
            return;
        }

        const waypoints = routeData.intermediateWaypoints.map(wp => ({
            location: { lat: wp.lat, lng: wp.lng },
            stopover: true
        }));

        directionsService.route(
        {
            origin: { lat: routeData.origin.lat, lng: routeData.origin.lng },
            destination: { lat: routeData.destination.lat, lng: routeData.destination.lng },
            waypoints: waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: true, // Match planner behavior if needed
        },
        (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
                directionsRenderer.setDirections(result);
                setDirectionsResult(result); // Store the result

                // --- Adjust Map Bounds ---
                // Ensure map and result are available
                 if (map && result.routes && result.routes.length > 0) {
                    const bounds = result.routes[0].bounds;
                    if (bounds) {
                       map.fitBounds(bounds);
                       // Add some padding if needed
                       // map.panToBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
                     }
                 }
                 // --- End Adjust Map Bounds ---

            } else {
                console.error(`Directions request failed due to ${status}`);
                // Optionally show a toast message here
            }
        }
        );
    }, [directionsService, directionsRenderer, routeData, map]); // Add map to dependencies


    // Combine all points for marker rendering
    const allWaypoints = [
        routeData.origin,
        ...routeData.intermediateWaypoints,
        routeData.destination,
    ].filter(Boolean) as Waypoint[]; // Filter out potential nulls if data is incomplete

    return (
        <Map
            mapId={`view_map_${routeData.id}`}
            // defaultCenter={mapCenter} // Center is handled by fitBounds
            // defaultZoom={10} // Zoom is handled by fitBounds
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            className="w-full h-full"
        >
            {/* Waypoint Markers */}
            {allWaypoints.map((waypoint, index) => {
                 const isOrigin = routeData.origin?.id === waypoint.id;
                 const isDestination = routeData.destination?.id === waypoint.id;
                 const pinColor = isOrigin ? '#3b82f6' : isDestination ? '#ef4444' : '#6b7280'; // Blue, Red, Gray
                 const glyph = isOrigin ? <LocateFixed className="w-4 h-4 text-white"/> : isDestination ? <Flag className="w-4 h-4 text-white"/> : <span className="text-xs font-bold">{routeData.intermediateWaypoints.findIndex(wp => wp.id === waypoint.id) + 1}</span>;

                return (
                    <AdvancedMarker key={waypoint.id} position={waypoint} title={waypoint.name}>
                        <Pin background={pinColor} glyphColor={'#fff'} borderColor={'#fff'}>
                            {glyph}
                        </Pin>
                    </AdvancedMarker>
                );
            })}

            {/* Photo Markers */}
            {routeData.photos.map((photo) => (
            <AdvancedMarker key={photo.id} position={photo.location} title={photo.description || "View Photo"}>
                <div className="p-1 bg-accent rounded-full shadow cursor-pointer transform hover:scale-110 transition-transform">
                <Camera className="w-4 h-4 text-accent-foreground" />
                </div>
            </AdvancedMarker>
            ))}

             {/* DirectionsRenderer handles the route line - managed by useEffect */}
        </Map>
    );
}


// --- Main Page Component ---
export default function ViewRoutePage() {
  const params = useParams();
  const routeId = params.routeId as string;
  const [routeData, setRouteData] = useState<StoredRouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (!routeId) {
      setLoading(false); // Stop loading if no ID
      setError("Invalid route ID.");
      return;
    };

    setLoading(true);
    setError(null);
    fetchRouteData(routeId)
      .then(data => {
        if (data) {
          // Validate required fields
          if (!data.origin || !data.destination) {
             setError('Route data is incomplete (missing origin or destination).');
             setRouteData(null);
          } else {
              setRouteData(data);
          }
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
      <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
         {/* Skeleton for Map Area */}
         <Card className="md:col-span-2">
            <CardHeader>
                 <Skeleton className="h-8 w-3/4 mb-2" />
                 <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-96 w-full rounded-lg" />
            </CardContent>
         </Card>
         {/* Skeleton for Side Panels */}
         <div className="space-y-4">
            <Card>
                <CardHeader>
                     <Skeleton className="h-6 w-2/3" />
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                     <Skeleton className="h-6 w-1/2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-32 w-full" />
                </CardContent>
            </Card>
         </div>
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

  // Combine waypoints for the list display
    const allWaypointsForList = [
        routeData.origin,
        ...routeData.intermediateWaypoints,
        routeData.destination,
    ];

  return (
    <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Map Area */}
        <Card className="md:col-span-2">
            <CardHeader>
            <CardTitle>{routeData.name}</CardTitle>
            <CardDescription>Route overview and photo locations.</CardDescription>
            </CardHeader>
            <CardContent>
            <div className="h-96 md:h-[500px] w-full rounded-lg overflow-hidden mb-4 shadow-md border border-border">
                {/* Use the extracted Map component */}
                <ViewRouteMap routeData={routeData} />
            </div>
            {/* Optionally display turn-by-turn directions if available and desired */}
            </CardContent>
        </Card>

      {/* Side Information Panels */}
      <div className="space-y-4">
         {/* Waypoints List */}
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary"/> Route Points</CardTitle>
            </CardHeader>
             <CardContent>
                <ul className="space-y-2">
                {allWaypointsForList.map((wp, index) => {
                    const isOrigin = index === 0;
                    const isDestination = index === allWaypointsForList.length - 1;
                    const isIntermediate = !isOrigin && !isDestination;

                     let icon;
                     let bgColor = 'bg-secondary/50'; // Default for intermediate
                     if (isOrigin) {
                         icon = <LocateFixed className="w-4 h-4 text-blue-600 flex-shrink-0"/>;
                         bgColor = 'bg-blue-100 dark:bg-blue-900/30';
                     } else if (isDestination) {
                         icon = <Flag className="w-4 h-4 text-red-600 flex-shrink-0"/>;
                         bgColor = 'bg-red-100 dark:bg-red-900/30';
                     } else {
                         // Calculate intermediate index correctly
                         const intermediateIndex = routeData.intermediateWaypoints.findIndex(iwp => iwp.id === wp.id);
                         icon = <span className="flex-shrink-0 w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center text-xs font-bold">{intermediateIndex + 1}</span>;
                     }

                     return (
                         <li key={wp.id} className={`flex items-start gap-3 text-sm p-2 ${bgColor} rounded-md`}>
                            <div className="pt-0.5">{icon}</div>
                            <div className="flex-grow overflow-hidden">
                                <span className="font-medium block truncate" title={wp.name || `Waypoint ${index + 1}`}>{wp.name || `Waypoint ${index + 1}`}</span>
                                {wp.address && <span className="text-xs text-muted-foreground block truncate" title={wp.address}>{wp.address}</span>}
                            </div>
                        </li>
                     );
                    })}
                </ul>
             </CardContent>
         </Card>

         {/* Photos Section */}
         <Card>
             <CardHeader>
                <CardTitle className="flex items-center gap-2"><Camera className="w-5 h-5 text-accent"/> Photos</CardTitle>
            </CardHeader>
            <CardContent>
                {routeData.photos.length === 0 ? (
                     <p className="text-sm text-muted-foreground">No photos added to this route yet.</p>
                ) : (
                <div className="grid grid-cols-2 gap-2">
                    {routeData.photos.map(photo => {
                       const linkedWaypoint = allWaypointsForList.find(wp => wp.id === photo.waypointId);
                       const altText = photo.description || (linkedWaypoint ? `Photo near ${linkedWaypoint.name}` : 'Route photo');

                       return (
                           <div key={photo.id} className="group relative overflow-hidden rounded-md shadow">
                                <Image
                                    src={photo.url}
                                    alt={altText}
                                    width={150} // Adjust size as needed
                                    height={100}
                                    className="object-cover w-full h-24 transition-transform duration-300 ease-in-out group-hover:scale-105"
                                    title={altText} // Add title attribute for tooltip
                                />
                                {(photo.description || linkedWaypoint) && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-2 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        {photo.description && <p className="font-medium line-clamp-1">{photo.description}</p>}
                                        {linkedWaypoint && <p className="text-white/80 line-clamp-1">Near: {linkedWaypoint.name}</p>}
                                    </div>
                                )}
                           </div>
                       );
                    })}
                </div>
                 )}
             </CardContent>
         </Card>
      </div>

    </div>
  );
}

    