
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import type { Coordinates } from '@/types/maps'; // Ensure correct import path
import { Map, AdvancedMarker, Pin, useMapsLibrary, useMap } from '@vis.gl/react-google-maps';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Camera, MapPin, LocateFixed, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast'; // Import useToast


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
  await new Promise(resolve => setTimeout(resolve, 1000));

  // In a real app: Fetch from Firestore 'routes' collection by routeId.
  // Handle not found cases.

  // --- Mock Data (Updated structure) ---
  // Simple route: SF Civic Center -> Pier 39 -> Ocean Beach
  if (routeId === 'route-1719604700000') { // Example ID, replace if needed
    return {
      id: routeId,
      name: "SF Short Tour",
      origin: { id: 'wp-origin-1', lat: 37.7793, lng: -122.4194, name: 'San Francisco City Hall', address: '1 Dr Carlton B Goodlett Pl, San Francisco, CA 94102' },
      destination: { id: 'wp-dest-1', lat: 37.7588, lng: -122.5134, name: 'Ocean Beach', address: 'Great Hwy, San Francisco, CA 94121' },
      intermediateWaypoints: [
        { id: 'wp-inter-1-1', lat: 37.8087, lng: -122.4098, name: 'Pier 39', address: 'Pier 39, San Francisco, CA 94133' },
      ],
      photos: [
        { id: 'ph-1-1', url: 'https://picsum.photos/seed/pier39/300/200', location: { lat: 37.8087, lng: -122.4098 }, waypointId: 'wp-inter-1-1', description: 'Sea Lions at Pier 39' },
        { id: 'ph-1-2', url: 'https://picsum.photos/seed/oceanbeach2/300/200', location: { lat: 37.7588, lng: -122.5134 }, waypointId: 'wp-dest-1', description: 'Sunset at Ocean Beach' },
      ],
    };
  }
  // More complex mock route if needed for testing
  else if (routeId === 'route-1719604800000') {
     return {
      id: routeId,
      name: "Coastal Drive Mock",
      origin: { id: 'wp-origin-2', lat: 37.7749, lng: -122.4194, name: 'Civic Center Plaza', address: 'San Francisco, CA, USA' },
      destination: { id: 'wp-dest-2', lat: 37.2970, lng: -122.0789, name: 'Half Moon Bay', address: 'Half Moon Bay, CA, USA' }, // Corrected lat/lng for HMB
      intermediateWaypoints: [
        { id: 'wp-inter-2-1', lat: 37.6000, lng: -122.4860, name: 'Pacifica Pier', address: 'Pacifica, CA, USA' },
        { id: 'wp-inter-2-2', lat: 37.4149, lng: -122.4580, name: 'Montara State Beach', address: 'Montara, CA, USA' }, // Corrected lat/lng
      ],
      photos: [
        { id: 'ph-2-1', url: 'https://picsum.photos/seed/pacifica/300/200', location: { lat: 37.6000, lng: -122.4860 }, waypointId: 'wp-inter-2-1', description: 'Fishing at Pacifica Pier' },
        { id: 'ph-2-2', url: 'https://picsum.photos/seed/montara/300/200', location: { lat: 37.4149, lng: -122.4580 }, waypointId: 'wp-inter-2-2', description: 'Cliffs at Montara' },
      ],
    };
  }
   else {
    console.warn(`Mock route not found for ID: ${routeId}`);
    return null; // Route not found
  }
  // --- End Mock Data ---
}


// --- View Route Map Component ---
// Extracted to handle map-specific logic and hooks
function ViewRouteMap({ routeData }: { routeData: StoredRouteData }) {
    const map = useMap();
    const routesLib = useMapsLibrary('routes');
    const { toast } = useToast();
    const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
    const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
    const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null); // Store the result

     // Combine all points for marker rendering and initial bounds calculation
    const allWaypoints = useMemo(() => [
        routeData.origin,
        ...routeData.intermediateWaypoints,
        routeData.destination,
    ].filter(Boolean) as Waypoint[], [routeData]);

    const allGeoPoints = useMemo(() => [
        ...allWaypoints,
        ...routeData.photos.map(p => ({ ...p.location, id: p.id })) // Include photo locations
    ], [allWaypoints, routeData.photos]);


    // --- Calculate Initial Bounds ---
    useEffect(() => {
        if (!map || allGeoPoints.length === 0) return;

        // Only fit bounds initially if there's more than one point, otherwise center on the single point
        if (allGeoPoints.length > 1) {
            const bounds = new google.maps.LatLngBounds();
            allGeoPoints.forEach(point => {
                bounds.extend(new google.maps.LatLng(point.lat, point.lng));
            });
            map.fitBounds(bounds, 100); // Add padding (e.g., 100 pixels)
        } else if (allGeoPoints.length === 1) {
             map.setCenter({ lat: allGeoPoints[0].lat, lng: allGeoPoints[0].lng });
             map.setZoom(14); // Set a reasonable zoom for a single point
        }

    }, [map, allGeoPoints]); // Depend on map instance and the points


     // Initialize Directions Service and Renderer
    useEffect(() => {
        if (!routesLib || !map) return;
        // Initialize only once
        if (!directionsService) {
             setDirectionsService(new routesLib.DirectionsService());
        }
        if (!directionsRenderer) {
            setDirectionsRenderer(new routesLib.DirectionsRenderer({
                map,
                suppressMarkers: true, // We use AdvancedMarkers
                polylineOptions: {
                    strokeColor: 'hsl(var(--primary))',
                    strokeOpacity: 0.8,
                    strokeWeight: 6,
                }
            }));
        }
    }, [routesLib, map, directionsService, directionsRenderer]);


      // Calculate and Render Directions
    useEffect(() => {
        // Ensure services, renderer, and essential data are ready
        if (!directionsService || !directionsRenderer || !routeData.origin || !routeData.destination) {
            // Clear previous route if conditions aren't met
            directionsRenderer?.setDirections(null);
            setDirectionsResult(null);
            return;
        }

        const waypoints = routeData.intermediateWaypoints.map(wp => ({
            location: { lat: wp.lat, lng: wp.lng },
            stopover: true
        }));

        console.log("Requesting directions with:", {
            origin: routeData.origin,
            destination: routeData.destination,
            waypoints: routeData.intermediateWaypoints
        });

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
                    console.log("Directions received:", result);
                    directionsRenderer.setDirections(result);
                    setDirectionsResult(result); // Store the result

                    // --- Adjust Map Bounds based on Route ---
                    // It's often better to fit to the route bounds after calculation
                     if (map && result.routes && result.routes.length > 0) {
                        const routeBounds = result.routes[0].bounds;
                        if (routeBounds) {
                           console.log("Fitting map to route bounds:", routeBounds.toJSON());
                           map.fitBounds(routeBounds, 50); // Add padding
                         }
                     }
                     // --- End Adjust Map Bounds ---

                } else {
                    console.error(`Directions request failed due to ${status}`);
                    toast({ title: "Routing Error", description: `Could not calculate the route. Status: ${status}`, variant: "destructive" });
                    directionsRenderer.setDirections(null); // Clear the route line on error
                    setDirectionsResult(null);
                }
            }
        );
    // Add map to dependencies ONLY IF map instance changes fundamentally. Often not needed.
    // Key dependencies are the services and the route data itself.
    }, [directionsService, directionsRenderer, routeData, map, toast]); // Removed map from deps if stable


    // --- Render ---
    // No need for explicit <Map> here if it's provided by the parent context where APIProvider is used
    // We just render the markers and rely on the useEffects to draw the route on the map instance passed down
    return (
        <>
            {/* Waypoint Markers */}
            {allWaypoints.map((waypoint) => {
                 const isOrigin = routeData.origin?.id === waypoint.id;
                 const isDestination = routeData.destination?.id === waypoint.id;
                 // Correctly find the index for intermediate waypoints
                 const intermediateIndex = routeData.intermediateWaypoints.findIndex(wp => wp.id === waypoint.id);
                 const isIntermediate = intermediateIndex !== -1;

                 const pinColor = isOrigin ? 'hsl(var(--primary))' : isDestination ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))'; // Use theme colors
                 const glyph = isOrigin ? <LocateFixed className="w-4 h-4 text-primary-foreground"/> : isDestination ? <Flag className="w-4 h-4 text-destructive-foreground"/> : <span className="text-xs font-bold text-white">{intermediateIndex + 1}</span>;

                return (
                    <AdvancedMarker key={waypoint.id} position={waypoint} title={waypoint.name || `Waypoint ${waypoint.id}`}>
                        <Pin background={pinColor} glyphColor={'hsl(var(--primary-foreground))'} borderColor={'hsl(var(--primary-foreground))'}>
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
        </>
    );
}


// --- Main Page Component ---
export default function ViewRoutePage() {
  const params = useParams();
  const routeId = params.routeId as string;
  const [routeData, setRouteData] = useState<StoredRouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates>({ lat: 37.7749, lng: -122.4194 }); // Default SF


  useEffect(() => {
    if (!routeId) {
      setLoading(false); // Stop loading if no ID
      setError("Invalid route ID provided in the URL.");
      return;
    };

    console.log(`Attempting to load route for ID: ${routeId}`);
    setLoading(true);
    setError(null);
    fetchRouteData(routeId)
      .then(data => {
        console.log("Fetched data:", data);
        if (data) {
          // Validate required fields
          if (!data.origin || !data.destination) {
             console.error('Route data is incomplete:', data);
             setError('Route data is incomplete (missing origin or destination).');
             setRouteData(null);
          } else {
              setRouteData(data);
              // Set initial map center based on origin
              setMapCenter({ lat: data.origin.lat, lng: data.origin.lng });
              console.log("Route data set successfully:", data);
          }
        } else {
          console.warn(`Route not found for ID: ${routeId}`);
          setError('Route not found. Please check the link.');
          setRouteData(null);
        }
      })
      .catch(err => {
        console.error("Error fetching route:", err);
        setError('Failed to load route data due to a network or server error.');
         setRouteData(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [routeId]);

  // --- Combine waypoints for the list display ---
   const allWaypointsForList = useMemo(() => {
        if (!routeData) return [];
        return [
            routeData.origin,
            ...routeData.intermediateWaypoints,
            routeData.destination,
        ];
    }, [routeData]);


  // --- Render Logic ---

  if (loading) {
    return (
      <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
         {/* Skeleton for Map Area */}
         <Card className="md:col-span-2">
            <CardHeader>
                 <Skeleton className="h-8 w-3/4 mb-2 rounded" />
                 <Skeleton className="h-4 w-1/2 rounded" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-96 w-full rounded-lg" />
            </CardContent>
         </Card>
         {/* Skeleton for Side Panels */}
         <div className="space-y-4">
            <Card>
                <CardHeader>
                     <Skeleton className="h-6 w-2/3 rounded" />
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-10 w-full rounded" />
                     <Skeleton className="h-10 w-full rounded" />
                      <Skeleton className="h-10 w-full rounded" />
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                     <Skeleton className="h-6 w-1/2 rounded" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-32 w-full rounded" />
                </CardContent>
            </Card>
         </div>
      </div>
    );
  }

  if (error) {
    return <div className="container mx-auto p-4 text-center text-destructive font-medium">{error}</div>;
  }

  if (!routeData) {
    // This state might occur if fetch completed but data was null/invalid without setting error explicitly
    return <div className="container mx-auto p-4 text-center text-muted-foreground">Route data could not be displayed.</div>;
  }

  return (
    <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Map Area */}
        <Card className="md:col-span-2">
            <CardHeader>
            <CardTitle>{routeData.name}</CardTitle>
            <CardDescription>Route overview and photo locations.</CardDescription>
            </CardHeader>
            <CardContent>
            {/* Ensure Map has sufficient height */}
            <div className="h-96 md:h-[500px] lg:h-[600px] w-full rounded-lg overflow-hidden shadow-md border border-border">
                 <Map
                    mapId={`view_map_${routeData.id}`}
                    defaultCenter={mapCenter} // Use state for default center
                    defaultZoom={10} // Let fitBounds adjust zoom later
                    gestureHandling={'greedy'}
                    disableDefaultUI={true}
                    mapTypeControl={false}
                    streetViewControl={false}
                    fullscreenControl={false}
                    className="w-full h-full"
                 >
                    {/* Render markers and route line */}
                    <ViewRouteMap routeData={routeData} />
                 </Map>
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
                    // Determine type based on index in the combined list
                    const isOrigin = index === 0;
                    const isDestination = index === allWaypointsForList.length - 1;
                    const isIntermediate = !isOrigin && !isDestination;

                     let icon;
                     let bgColorClass = 'bg-secondary/50'; // Default background for intermediate stops

                     if (isOrigin) {
                         icon = <LocateFixed className="w-4 h-4 text-primary flex-shrink-0"/>;
                         bgColorClass = 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'; // Enhanced styling
                     } else if (isDestination) {
                         icon = <Flag className="w-4 h-4 text-destructive flex-shrink-0"/>;
                          bgColorClass = 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'; // Enhanced styling
                     } else {
                         // Calculate intermediate index based on original intermediateWaypoints array
                         const intermediateIndex = routeData.intermediateWaypoints.findIndex(iwp => iwp.id === wp.id);
                         icon = <span className="flex-shrink-0 w-5 h-5 bg-muted-foreground text-background rounded-full flex items-center justify-center text-xs font-bold">{intermediateIndex + 1}</span>;
                         bgColorClass = 'bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700'; // Enhanced styling
                     }

                     return (
                         <li key={wp.id} className={`flex items-start gap-3 text-sm p-3 ${bgColorClass} rounded-md shadow-sm`}>
                            <div className="pt-0.5">{icon}</div>
                            <div className="flex-grow overflow-hidden">
                                <span className="font-medium block truncate text-foreground" title={wp.name || `Waypoint ${index + 1}`}>{wp.name || `Waypoint ${index + 1}`}</span>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-2">
                    {routeData.photos.map(photo => {
                       // Find the waypoint this photo is linked to
                       const linkedWaypoint = allWaypointsForList.find(wp => wp.id === photo.waypointId);
                       const altText = photo.description || (linkedWaypoint ? `Photo near ${linkedWaypoint.name}` : 'Route photo');

                       return (
                           <div key={photo.id} className="group relative overflow-hidden rounded-md shadow border border-border aspect-video">
                                <Image
                                    src={photo.url}
                                    alt={altText}
                                    layout="fill" // Use fill layout for aspect ratio control
                                    objectFit="cover" // Cover the area
                                    className="transition-transform duration-300 ease-in-out group-hover:scale-105"
                                    title={altText} // Add title attribute for tooltip on hover
                                />
                                {(photo.description || linkedWaypoint) && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-2 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                        {photo.description && <p className="font-semibold line-clamp-1">{photo.description}</p>}
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

    