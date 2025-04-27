

'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import type { Coordinates } from '@/types/maps'; // Ensure correct import path
import { Map, AdvancedMarker, Pin, useMapsLibrary, useMap } from '@vis.gl/react-google-maps';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Camera, MapPin, LocateFixed, Flag } from 'lucide-react';
// Removed Button import as it's not used here anymore
import { useToast } from '@/hooks/use-toast'; // Import useToast


// --- Interfaces (Should ideally be shared/imported) ---
interface Waypoint extends Coordinates {
  id: string;
  name?: string;
  address?: string;
}

// Interface matching the one in route-planner.tsx
interface Photo {
  id: string;
  url: string; // URL from cloud storage
  location: Coordinates;
  waypointId?: string; // Only present if locationSource is 'waypoint'
  description?: string;
  locationSource: 'exif' | 'waypoint'; // Track where the location came from
}

// Matches the structure expected from the backend API/database
interface StoredRouteData {
  id: string;
  name: string;
  origin: Waypoint;
  destination: Waypoint;
  intermediateWaypoints: Waypoint[];
  photos: Photo[];
  creatorId?: string; // Optional for now
  // directionsResultJson?: string; // Optional
}

// --- Fetch Function (Now fetches from API) ---
async function fetchRouteData(routeId: string): Promise<StoredRouteData | null> {
  console.log(`Fetching route data for ID: ${routeId} from API`);
  try {
      const response = await fetch(`/api/routes/${routeId}`); // Use API route

      if (response.status === 404) {
           console.warn(`Route ${routeId} not found via API.`);
           return null;
      }

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `API error! status: ${response.status}`);
      }

      const routeData: StoredRouteData = await response.json();
      console.log(`Successfully fetched route ${routeId} from API.`);

      // Basic validation (optional, API should ideally return valid data)
      if (!routeData || !routeData.id || !routeData.origin || !routeData.destination) {
            console.error("Fetched route data is incomplete:", routeData);
            throw new Error("Fetched route data is incomplete.");
      }

       // Ensure photos array has locationSource (for data consistency if needed)
      routeData.photos = routeData.photos.map(p => ({
        ...p,
        locationSource: p.locationSource || 'waypoint' // Default if missing
      }));

      return routeData;

  } catch (error: any) {
      console.error(`Error fetching route data for ${routeId} from API:`, error);
      // Optionally, you could try falling back to localStorage here if desired,
      // but generally, the API should be the source of truth.
      // const storedRouteJson = localStorage.getItem(`route_${routeId}`);
      // ... (localStorage fallback logic if needed) ...

      // If no fallback or fallback fails:
      return null; // Indicate failure to fetch
  }
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
            // Delay fitting bounds slightly to ensure map tiles are loaded
             setTimeout(() => map.fitBounds(bounds, 100), 100); // Add padding (e.g., 100 pixels)
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
         // Clean up renderer on component unmount
        return () => {
          directionsRenderer?.setMap(null);
        };
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
                    // Only fit bounds if the map instance is valid and route has bounds
                     if (map && result.routes?.[0]?.bounds) {
                        const routeBounds = result.routes[0].bounds;
                           console.log("Fitting map to route bounds:", routeBounds.toJSON());
                            // Delay fitting bounds slightly AFTER directions render
                            setTimeout(() => map.fitBounds(routeBounds, 50), 50); // Add padding
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
    // Key dependencies are the services, the route data, and the renderer.
    // Avoid depending directly on 'map' if possible, unless its identity changes.
    }, [directionsService, directionsRenderer, routeData, toast, map]); // Added map back as directionsRenderer depends on it implicitly


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
                 {/* Style marker based on location source */}
                <div className={`p-1 rounded-full shadow-md cursor-pointer transform hover:scale-110 transition-transform ${photo.locationSource === 'exif' ? 'bg-green-500' : 'bg-accent'}`}>
                    <Camera className="w-4 h-4 text-white" />
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
  const [mapKey, setMapKey] = useState<string>(`map-${Date.now()}`); // Force map re-render on route change
  const { toast } = useToast(); // Get toast function


  useEffect(() => {
    if (!routeId) {
      setLoading(false); // Stop loading if no ID
      setError("Invalid route ID provided in the URL.");
      return;
    };

    console.log(`Attempting to load route for ID: ${routeId}`);
    setLoading(true);
    setError(null);
    setRouteData(null); // Clear previous data
    setMapKey(`map-${routeId}-${Date.now()}`); // Change map key to force re-mount

    fetchRouteData(routeId)
      .then(data => {
        console.log("Fetched data via API:", data);
        if (data) {
          // Basic validation moved within fetchRouteData or assumed correct from API
           setRouteData(data);
           // Set initial map center based on origin
           setMapCenter({ lat: data.origin.lat, lng: data.origin.lng });
           console.log("Route data set successfully:", data);
        } else {
          console.warn(`Route not found for ID: ${routeId}`);
          setError(`Route not found. Please check the link. (ID: ${routeId})`);
          setRouteData(null);
          toast({ // Add toast notification for route not found
              title: "Route Not Found",
              description: `Could not find a route with the ID ${routeId}.`,
              variant: "destructive",
          });
        }
      })
      .catch(err => {
        console.error("Error fetching route:", err);
        setError(`Failed to load route data. ${err.message || 'Please try again later.'}`);
         setRouteData(null);
         toast({ // Add toast notification for fetch error
              title: "Loading Error",
              description: `Failed to load route data: ${err.message || 'Network or server error.'}`,
              variant: "destructive",
          });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [routeId, toast]); // Re-run only when routeId changes, added toast dependency

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
    return <div className="container mx-auto p-4 text-center text-muted-foreground">Route data could not be displayed. Please ensure the link is correct.</div>;
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
                    key={mapKey} // Force re-mount on route ID change
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
                       // Find waypoint ONLY if the photo location came from the waypoint
                       const linkedWaypoint = photo.locationSource === 'waypoint'
                          ? allWaypointsForList.find(wp => wp.id === photo.waypointId)
                          : null; // Don't show linked waypoint if location is from EXIF

                       const altText = photo.description || (linkedWaypoint ? `Photo near ${linkedWaypoint.name}` : 'Route photo');

                       return (
                           <div key={photo.id} className="group relative overflow-hidden rounded-md shadow border border-border aspect-video">
                                <Image
                                    src={photo.url} // Use the URL from DB/Cloud Storage
                                    alt={altText}
                                    fill // Use fill layout for aspect ratio control
                                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 50vw" // Optimize image loading
                                    style={{ objectFit: 'cover' }} // Cover the area
                                    className="transition-transform duration-300 ease-in-out group-hover:scale-105"
                                    title={altText} // Add title attribute for tooltip on hover
                                    // Consider adding error handling for image loading
                                    onError={(e) => {
                                        console.error(`Error loading image: ${photo.url}`);
                                        // Optionally replace src with a placeholder
                                        // e.currentTarget.src = '/placeholder-image.png';
                                    }}
                                />
                                {/* Location Source Badge */}
                                <span className={`absolute top-1 right-1 text-[10px] font-semibold px-1.5 py-0.5 rounded shadow ${photo.locationSource === 'exif' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'}`}>
                                    {photo.locationSource.toUpperCase()}
                                </span>
                                {(photo.description || linkedWaypoint) && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-2 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                        {photo.description && <p className="font-semibold line-clamp-1">{photo.description}</p>}
                                        {linkedWaypoint && <p className="text-white/80 line-clamp-1">Near: {linkedWaypoint.name}</p>}
                                        {/* Display coordinates for EXIF photos */}
                                        {photo.locationSource === 'exif' && <p className="text-white/80 line-clamp-1">Loc: {photo.location.lat.toFixed(4)}, {photo.location.lng.toFixed(4)}</p>}
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
