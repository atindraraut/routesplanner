
'use client'

// NOTE: exif-js has potential memory leak issues with large images or frequent use.
// Consider a more modern library like 'exifr' if issues arise.
import EXIF, { type GPSLongitude, type GPSLatitude } from 'exif-js';

import type { Coordinates } from '@/types/maps'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Map,
    useMap,
  useMapsLibrary,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Share2, Save, MapPin, Camera, Trash2, LocateFixed, Flag, PlusCircle, Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// --- API Actions ---
// We'll define server actions for database operations in separate files later
// For now, let's define placeholder functions that would call these actions.

// Placeholder for a server action to save the route
async function saveRouteAction(routeData: StoredRouteData): Promise<{ success: boolean; routeId?: string; error?: string }> {
    // This would typically be in `src/actions/saveRoute.ts`
    console.log("Calling saveRouteAction (placeholder)", routeData);
    // In a real implementation:
    // 1. Connect to DB: await dbConnect();
    // 2. Create or Update Route: const route = new Route(routeData); await route.save();
    // 3. Handle errors
    // 4. Return success/failure and ID
    try {
      // Simulate saving to a backend (replace with actual API call/server action)
      const response = await fetch('/api/routes', { // Example API endpoint
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(routeData),
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("saveRouteAction response:", result);
      return { success: true, routeId: result.id };

    } catch (error: any) {
        console.error("Error in saveRouteAction:", error);
        const errorDetails = {
            name: error.name || 'Unknown Error',
            message: error.message || "Failed to save route.",
            cause: error.cause || "No additional cause information available."
        };

        return { success: false, error: JSON.stringify(errorDetails, null, 2) };
    }
}

// Placeholder for a server action to upload a photo and get its URL
// In a real app, this would upload to cloud storage (like Firebase Storage or S3)
// and return the public URL. It might also update the Route document directly
// or return info needed to update it on the client.
async function uploadPhotoAction(fileDataUrl: string, routeId: string, photoInfo: Omit<Photo, 'url' | 'id'>): Promise<{ success: boolean; photoId?: string; photoUrl?: string; error?: string }> {
    console.log(`Calling uploadPhotoAction for route ${routeId} (placeholder)`);
    // 1. Decode base64 data URL
    // 2. Upload image buffer to cloud storage (e.g., Firebase Storage, S3)
    // 3. Get the public URL of the uploaded image
    // 4. Optionally: Update the corresponding Route document in MongoDB to add the photo metadata
    // 5. Return success, the new photo's ID (maybe generated on server), and the URL

    try {
         // Simulate backend upload and URL generation
         const response = await fetch('/api/photos/upload', { // Example API endpoint
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ routeId, photoDataUrl: fileDataUrl, ...photoInfo }),
         });

         if (!response.ok) {
             const errorData = await response.json();
             throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
         }

         const result = await response.json();
         console.log("uploadPhotoAction response:", result);
         return { success: true, photoId: result.photoId, photoUrl: result.photoUrl };

    } catch (error: any) {
         console.error("Error in uploadPhotoAction:", error);
         return { success: false, error: error.message || "Failed to upload photo." };
    }
}


// --- Constants ---
const DEFAULT_CENTER: Coordinates = { lat: 37.7749, lng: -122.4194 } // San Francisco
const DEFAULT_ZOOM = 12
const MAX_INTERMEDIATE_WAYPOINTS = 8 // Limit intermediate waypoints (Origin + Dest + 8 = 10 total)

// --- Interfaces ---
interface Waypoint extends Coordinates {
  id: string
  name?: string // Optional name for the waypoint
  address?: string // Store formatted address
}

interface Photo {
  id: string; // Unique ID for the photo (can be generated client or server side)
  url: string; // URL pointing to the image (e.g., cloud storage URL)
  location: Coordinates;
  waypointId?: string; // Link photo to a waypoint IF location is NOT from EXIF
  description?: string;
  locationSource: 'exif' | 'waypoint'; // Track where the location came from
}

// Data structure for saving/fetching from the backend
interface StoredRouteData {
  id: string; // Unique ID for the route
  name: string;
  origin: Waypoint;
  destination: Waypoint;
  intermediateWaypoints: Waypoint[];
  photos: Photo[]; // Store photo metadata, not base64 data
  creatorId?: string; // Add creator ID (will be needed for auth)
  // directionsResultJson?: string; // Optional: Store stringified DirectionsResult (less ideal)
}

// --- Helper Function ---
// Converts DMS (Degrees, Minutes, Seconds) from EXIF to DD (Decimal Degrees)
function convertDMSToDD(dms: number[] | undefined, ref: string | undefined): number | null {
    if (!dms || !ref || dms.length !== 3) {
         console.debug("convertDMSToDD: Invalid DMS or ref", { dms, ref });
         return null;
    }

    const degrees = dms[0] ?? 0;
    const minutes = dms[1] ?? 0;
    const seconds = dms[2] ?? 0;

    let dd = degrees + minutes / 60 + seconds / 3600;

    // Adjust sign based on reference (N/S, E/W)
    if (ref === 'S' || ref === 'W') {
        dd = dd * -1;
    }
    // console.debug("convertDMSToDD: Conversion result", { dms, ref, dd });
    return dd;
}

// Extracts GPS Location from a photo file using exif-js
// Returns a Promise that resolves with Coordinates or rejects with an error message.
const extractLocationFromPhoto = (file: File): Promise<Coordinates> => {
    console.log("extractLocationFromPhoto: Starting extraction for file:", file.name, "Size:", file.size);

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            if (!arrayBuffer) {
                console.error("extractLocationFromPhoto: Failed to read file as ArrayBuffer.");
                return reject("Unable to read the selected file.");
            }

            try {
                const exifData = EXIF.readFromBinaryFile(arrayBuffer);
                const latArr = exifData?.GPSLatitude as GPSLatitude | undefined;
                const lonArr = exifData?.GPSLongitude as GPSLongitude | undefined;
                const latRef = exifData?.GPSLatitudeRef as string | undefined;
                const lonRef = exifData?.GPSLongitudeRef as string | undefined;

                console.debug("extractLocationFromPhoto: Extracted GPS data - latArr:", latArr, "lonArr:", lonArr, "latRef:", latRef, "lonRef:", lonRef);

                if (latArr && lonArr && latRef && lonRef) {
                    const lat = convertDMSToDD(latArr, latRef);
                    const lng = convertDMSToDD(lonArr, lonRef);

                    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
                        console.log(`extractLocationFromPhoto: Successfully extracted location for ${file.name}:`, { lat, lng });
                        resolve({ lat, lng });
                    } else {
                        console.warn(`extractLocationFromPhoto: Invalid GPS data in photo ${file.name}.`);
                        reject(`Invalid GPS data in photo ${file.name}.`);
                    }
                } else {
                    console.warn(`extractLocationFromPhoto: GPS data missing in photo ${file.name}.`);
                    reject(`GPS data missing in photo ${file.name}.`);
                }
            } catch (error) {
                console.error(`extractLocationFromPhoto: Error reading EXIF data for ${file.name}:`, error);
                reject(`Error reading EXIF data for ${file.name}.`);
            }
        };

        reader.onerror = () => {
            console.error("extractLocationFromPhoto: FileReader encountered an error.");
            reject("Error reading the selected file.");
        };

        reader.readAsArrayBuffer(file);
    });
};


// --- Component ---
export function RoutePlanner() {
  const map = useMap()
  const mapsLib = useMapsLibrary('routes')
  const placesLib = useMapsLibrary('places')
  const { toast } = useToast()

  const [routeName, setRouteName] = useState<string>('My Awesome Route')
  const [origin, setOrigin] = useState<Waypoint | null>(null)
  const [destination, setDestination] = useState<Waypoint | null>(null)
  const [intermediateWaypoints, setIntermediateWaypoints] = useState<Waypoint[]>([])
  const [photos, setPhotos] = useState<Photo[]>([]) // Store photo metadata (URL, location, etc.)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [activeMarker, setActiveMarker] = useState<string | null>(null) // Waypoint ID or Photo ID
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null)
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [photoUploadWaypointContext, setPhotoUploadWaypointContext] = useState<{ id: string; location: Coordinates } | null>(null); // Context for adding photo from waypoint info window
  const [photoDescription, setPhotoDescription] = useState('')
  const [savedRouteId, setSavedRouteId] = useState<string | null>(null); // Store the generated route ID after saving

  const fileInputRef = useRef<HTMLInputElement>(null);
  const originAutocompleteInputRef = useRef<HTMLInputElement>(null);
  const destinationAutocompleteInputRef = useRef<HTMLInputElement>(null);
  const intermediateAutocompleteInputRef = useRef<HTMLInputElement>(null); // For adding intermediate points via search

  const [originAutocomplete, setOriginAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [destinationAutocomplete, setDestinationAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [intermediateAutocomplete, setIntermediateAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  // --- Effects ---

  // Initialize Directions Service and Renderer
    useEffect(() => {
        if (!mapsLib || !map) return;
        setDirectionsService(new mapsLib.DirectionsService());
        setDirectionsRenderer(new mapsLib.DirectionsRenderer({
            map,
            suppressMarkers: true, // We use AdvancedMarker for custom markers
            polylineOptions: {
                strokeColor: 'hsl(var(--primary))',
                strokeOpacity: 0.8,
                strokeWeight: 6,
            }
        }));
    }, [mapsLib, map]);

    // Initialize Autocomplete functionality
    const initializeAutocomplete = useCallback((
        inputRef: React.RefObject<HTMLInputElement>,
        setter: React.Dispatch<React.SetStateAction<google.maps.places.Autocomplete | null>>,
        onPlaceChanged: (place: google.maps.places.PlaceResult) => void
      ) => {
        if (!placesLib || !inputRef.current || !window.google || !window.google.maps) {
          console.error('initializeAutocomplete: Places library or Google Maps not loaded properly.');
          return null; // Indicate failure
        }

        // Check if already initialized
        if (inputRef.current.getAttribute('data-autocomplete-initialized') === 'true') {
            console.log("Autocomplete already initialized for", inputRef.current.id);
            return null; // Don't re-initialize
        }

        const options = {
          fields: ["formatted_address", "geometry", "name"],
          strictBounds: false, // Be more flexible
        };

        console.log("Initializing Autocomplete for:", inputRef.current.id);
        const ac = new placesLib.Autocomplete(inputRef.current, options);
        inputRef.current.setAttribute('data-autocomplete-initialized', 'true'); // Mark as initialized

        // Use a stable handler reference if possible or manage listener removal carefully
        const placeChangedListener = () => {
            const place = ac.getPlace();
             console.log(`Place changed for ${inputRef.current?.id}:`, place);
            if (place.geometry?.location) {
               onPlaceChanged(place);
            } else {
                 toast({ title: "Location not found", description: "Could not find coordinates for the selected place.", variant: "destructive" });
            }
             // Clear input after selection for intermediate waypoints only
            if (inputRef === intermediateAutocompleteInputRef && inputRef.current) {
                inputRef.current.value = '';
            }
        };

        // Store listener reference for cleanup
        (ac as any)._placeChangedListener = placeChangedListener; // Store on the AC instance
        ac.addListener('place_changed', placeChangedListener);

         setter(ac); // Set the autocomplete instance in state
         return ac; // Return the instance
      }, [placesLib, toast]);


      // Initialize All Autocompletes
    useEffect(() => {
        if (!placesLib || !map) { // Ensure map is also available if needed by handlers indirectly
            console.log("PlacesLib or Map not ready, delaying autocomplete initialization.");
            return;
        }

        // --- Stable Handlers defined outside or wrapped in useCallback ---
        const handleSetOriginStable = (place: google.maps.places.PlaceResult) => {
            const newOrigin = createWaypoint(place);
            if (newOrigin) {
                setOrigin(newOrigin);
                map?.panTo({ lat: newOrigin.lat, lng: newOrigin.lng });
                if (originAutocompleteInputRef.current && place.formatted_address) {
                    originAutocompleteInputRef.current.value = place.formatted_address; // Update input field
                }
                setActiveMarker(newOrigin.id);
                setSavedRouteId(null); // Route changed, invalidate saved ID
            }
        };

        const handleSetDestinationStable = (place: google.maps.places.PlaceResult) => {
             const newDest = createWaypoint(place);
             if (newDest) {
                setDestination(newDest);
                map?.panTo({ lat: newDest.lat, lng: newDest.lng });
                if (destinationAutocompleteInputRef.current && place.formatted_address) {
                    destinationAutocompleteInputRef.current.value = place.formatted_address; // Update input field
                }
                setActiveMarker(newDest.id);
                setSavedRouteId(null); // Route changed
             }
        };

        const addIntermediateWaypointStable = (lat: number, lng: number, name?: string, address?: string) => {
           if (intermediateWaypoints.length >= MAX_INTERMEDIATE_WAYPOINTS) {
             toast({ title: "Waypoint Limit Reached", description: `You can add a maximum of ${MAX_INTERMEDIATE_WAYPOINTS} intermediate waypoints.`, variant: "destructive" });
             return;
           }
           const newWaypoint: Waypoint = {
               id: `wp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
               lat,
               lng,
               name: name ?? `Waypoint ${intermediateWaypoints.length + 1}`,
               address: address ?? `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
           };
           setIntermediateWaypoints(prev => [...prev, newWaypoint]);
           setActiveMarker(newWaypoint.id); // Make the new marker active
           map?.panTo({ lat, lng });
           setSavedRouteId(null); // Route changed
         };


         const handleAddIntermediateStable = (place: google.maps.places.PlaceResult) => {
             if (place.geometry?.location) {
                addIntermediateWaypointStable(place.geometry.location.lat(), place.geometry.location.lng(), place.name, place.formatted_address);
             }
         };
         // --- End Stable Handlers ---


        console.log("useEffect: Initializing autocompletes...");
        const acOrigin = initializeAutocomplete(originAutocompleteInputRef, setOriginAutocomplete, handleSetOriginStable);
        const acDest = initializeAutocomplete(destinationAutocompleteInputRef, setDestinationAutocomplete, handleSetDestinationStable);
        const acInter = initializeAutocomplete(intermediateAutocompleteInputRef, setIntermediateAutocomplete, handleAddIntermediateStable);

        // Cleanup listeners on unmount
        return () => {
          console.log("useEffect Cleanup: Removing autocomplete listeners...");
          [acOrigin, acDest, acInter].forEach(ac => {
             if (ac && window.google && window.google.maps && (ac as any)._placeChangedListener) {
                try {
                    window.google.maps.event.removeListener((ac as any)._placeChangedListener);
                    console.log("Removed place_changed listener for:", (ac as any)?.gm_accessors_?.place?.Mb?.gm_accessors_?.input?.forwarding?.id || 'unknown AC');
                    window.google.maps.event.clearInstanceListeners(ac); // Clear any other listeners too
                } catch (e) {
                     console.warn("Error removing autocomplete listener:", e);
                }
             }
          });
           // Also reset the state variables
           setOriginAutocomplete(null);
           setDestinationAutocomplete(null);
           setIntermediateAutocomplete(null);
           // Mark inputs as uninitialized for potential re-renders
            if (originAutocompleteInputRef.current) originAutocompleteInputRef.current.removeAttribute('data-autocomplete-initialized');
            if (destinationAutocompleteInputRef.current) destinationAutocompleteInputRef.current.removeAttribute('data-autocomplete-initialized');
            if (intermediateAutocompleteInputRef.current) intermediateAutocompleteInputRef.current.removeAttribute('data-autocomplete-initialized');
             console.log("useEffect Cleanup: Autocomplete cleanup finished.");
        };
      // Dependencies should ideally be stable references or primitives
      }, [placesLib, map, initializeAutocomplete, toast]); // Add map and toast, remove handlers


  // Update directions when route points change
    useEffect(() => {
    if (!window.google || !window.google.maps) return; // Guard against Maps API not loaded
    if (!directionsService || !directionsRenderer) {
        console.warn("Directions service or renderer not ready.");
        return; // Services not initialized yet
    }

    // Clear route if essential points are missing
    if (!origin || !destination) {
        console.log("Clearing directions: Origin or destination missing.");
        directionsRenderer?.setDirections(null);
        setDirections(null);
        return;
    }

     // Prepare waypoints for the request
    const waypoints = intermediateWaypoints.map(wp => ({
        location: { lat: wp.lat, lng: wp.lng },
        stopover: true
    }));

     console.log("Requesting directions with:", { origin: origin.id, destination: destination.id, waypoints: intermediateWaypoints.map(w=>w.id) });

    directionsService.route(
      {
          origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING, // Or other modes
        optimizeWaypoints: true, // Let Google optimize the intermediate order if desired
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
           console.log("Directions received successfully:", result);
          directionsRenderer.setDirections(result);
          setDirections(result);
            // Optionally fit map bounds to the new route
            if (map && result.routes?.[0]?.bounds) {
                // setTimeout(() => map.fitBounds(result!.routes[0].bounds, 50), 100); // Slight delay for render
            }
        } else {
          console.error(`Directions request failed due to ${status}`);
          toast({ title: "Routing Error", description: `Could not calculate the route. Status: ${status}`, variant: "destructive" });
          directionsRenderer.setDirections(null); // Clear route line on error
          setDirections(null);
        }
      }
    );
    // Dependency array includes all route points and the map instance for potential bounds fitting
  }, [origin, destination, intermediateWaypoints, directionsService, directionsRenderer, toast, map]);


  // --- Handlers ---

  // Creates a Waypoint object from a Google PlaceResult
    const createWaypoint = (place: google.maps.places.PlaceResult): Waypoint | null => {
        if (!place.geometry?.location) return null;
        return {
            id: `wp-${Date.now()}-${Math.random().toString(16).slice(2)}`, // Unique ID
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            name: place.name || "Selected Location",
            address: place.formatted_address || `Coordinates: ${place.geometry.location.lat().toFixed(5)}, ${place.geometry.location.lng().toFixed(5)}`
        };
    }

    // Handlers need to be stable (defined outside or useCallback) if used in dependencies
    const handleSetOrigin = useCallback((place: google.maps.places.PlaceResult) => {
         const newOrigin = createWaypoint(place);
         if (newOrigin) {
            setOrigin(newOrigin);
            map?.panTo({ lat: newOrigin.lat, lng: newOrigin.lng });
            if (originAutocompleteInputRef.current && place.formatted_address) {
                originAutocompleteInputRef.current.value = place.formatted_address;
            }
            setActiveMarker(newOrigin.id);
            setSavedRouteId(null); // Route changed
         }
    }, [map]); // Add map to dependency if used

     const handleSetDestination = useCallback((place: google.maps.places.PlaceResult) => {
         const newDest = createWaypoint(place);
         if (newDest) {
            setDestination(newDest);
            map?.panTo({ lat: newDest.lat, lng: newDest.lng });
             if (destinationAutocompleteInputRef.current && place.formatted_address) {
                 destinationAutocompleteInputRef.current.value = place.formatted_address;
             }
            setActiveMarker(newDest.id);
            setSavedRouteId(null); // Route changed
         }
     }, [map]); // Add map dependency

     const addIntermediateWaypoint = useCallback((lat: number, lng: number, name?: string, address?: string) => {
       if (intermediateWaypoints.length >= MAX_INTERMEDIATE_WAYPOINTS) {
         toast({ title: "Waypoint Limit Reached", description: `You can add a maximum of ${MAX_INTERMEDIATE_WAYPOINTS} intermediate waypoints.`, variant: "destructive" });
         return;
       }
       const newWaypoint: Waypoint = {
           id: `wp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
           lat,
           lng,
           name: name ?? `Waypoint ${intermediateWaypoints.length + 1}`,
           address: address ?? `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
       };
       setIntermediateWaypoints(prev => [...prev, newWaypoint]);
       setActiveMarker(newWaypoint.id); // Make the new marker active
       map?.panTo({ lat, lng });
       setSavedRouteId(null); // Route changed
     }, [intermediateWaypoints.length, toast, map]); // Add dependencies


    // Handles map clicks to set origin, destination, or intermediate points
    const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return;
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();

        // Attempt reverse geocoding to get a name/address
        if (placesLib) {
          const geocoder = new placesLib.Geocoder();
          geocoder.geocode({ location: event.latLng }, (results, status) => {
            let name = "Selected Location";
            let address = "Dropped Pin";
            if (status === 'OK' && results?.[0]) {
                 console.log("Reverse geocode success:", results[0]);
                 address = results[0].formatted_address || address;
                 // Try to find a more specific name (establishment, poi, etc.)
                 const foundName = results[0].address_components.find(c => c.types.includes('establishment') || c.types.includes('point_of_interest'))?.long_name;
                 name = foundName || results[0].address_components[0]?.long_name || name; // Fallback to first component name
            } else {
                 console.warn("Reverse geocode failed:", status);
                 address = `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`; // Fallback if geocoding fails
            }

            // Now set the point using the geocoded info (or fallback)
            const placeResultSimulated: google.maps.places.PlaceResult = {
                 geometry: { location: event.latLng! },
                 name: name,
                 formatted_address: address
            };

             if (!origin) {
                handleSetOrigin(placeResultSimulated);
                toast({ title: "Origin Set", description: `${name} added as starting point.` });
            } else if (!destination) {
                handleSetDestination(placeResultSimulated);
                toast({ title: "Destination Set", description: `${name} added as ending point.` });
            } else {
                 if (intermediateWaypoints.length < MAX_INTERMEDIATE_WAYPOINTS) {
                    addIntermediateWaypoint(lat, lng, name, address);
                    toast({ title: "Waypoint Added", description: `${name} added as an intermediate stop.` });
                 } else {
                    toast({ title: "Waypoint Limit Reached", description: `Cannot add more stops. Maximum is ${MAX_INTERMEDIATE_WAYPOINTS}.`, variant: "destructive" });
                 }
            }
          });
        } else {
            // Fallback if Places library isn't loaded (shouldn't happen ideally)
            const placeResultSimulated: google.maps.places.PlaceResult = {
                 geometry: { location: event.latLng! },
                 name: "Selected Location",
                 formatted_address: `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
            };
             if (!origin) handleSetOrigin(placeResultSimulated);
             else if (!destination) handleSetDestination(placeResultSimulated);
             // Ensure addIntermediateWaypoint is defined or passed correctly if placesLib is missing
             else if (typeof addIntermediateWaypoint === 'function') {
                 addIntermediateWaypoint(lat, lng, "Added Waypoint", `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
             } else {
                 console.error("addIntermediateWaypoint function not available in fallback.");
             }
        }

    }, [origin, destination, intermediateWaypoints.length, toast, placesLib, handleSetOrigin, handleSetDestination, addIntermediateWaypoint]); // Dependencies


    // Removes a waypoint (origin, destination, or intermediate)
    const removeWaypoint = (id: string) => {
        let removedType = "Waypoint";
        if (origin?.id === id) {
            setOrigin(null);
             if (originAutocompleteInputRef.current) originAutocompleteInputRef.current.value = '';
             removedType = "Origin";
        } else if (destination?.id === id) {
            setDestination(null);
            if (destinationAutocompleteInputRef.current) destinationAutocompleteInputRef.current.value = '';
             removedType = "Destination";
        } else {
            setIntermediateWaypoints(prev => prev.filter(wp => wp.id !== id));
        }

         if (activeMarker === id) {
            setActiveMarker(null); // Close InfoWindow if it was open for this marker
        }

        // Remove photos explicitly linked to this waypoint (locationSource == 'waypoint')
        const photosToRemove = photos.filter(p => p.waypointId === id && p.locationSource === 'waypoint').map(p => p.id);
        if (photosToRemove.length > 0) {
             setPhotos(prev => prev.filter(p => !photosToRemove.includes(p.id)));
             console.log(`Removed ${photosToRemove.length} photos linked to waypoint ${id}`);
             // TODO: Add API call to remove photos from backend storage and DB if needed
             // removePhotosAction(routeId, photosToRemove);
        }

         toast({ title: `${removedType} Removed` });
         setSavedRouteId(null); // Clear saved ID if route changes
    };

    // Handles clicking on a marker (waypoint or photo) to open its InfoWindow
    const handleMarkerClick = (id: string) => {
        setActiveMarker(id);
        // Find the marker's coordinates and pan the map
        const allWaypoints = [origin, destination, ...intermediateWaypoints].filter(Boolean) as Waypoint[];
        const marker = allWaypoints.find(wp => wp.id === id) || photos.find(p => p.id === id);
        if (marker && map) {
            const position = 'location' in marker ? marker.location : marker; // Check if photo or waypoint
            map.panTo(position);
        }
    };

    // Closes the currently open InfoWindow
    const handleInfoWindowClose = () => {
        setActiveMarker(null);
        setPhotoUploadWaypointContext(null); // Clear photo upload context
        setPhotoDescription('');
    };


    // Initiates the photo upload process when "Add Photo" is clicked in a waypoint's InfoWindow
    const handleAddPhotoClickFromWaypoint = (waypoint: Waypoint) => {
        if (!savedRouteId) {
            toast({title: "Save Route First", description: "Please save the route before adding photos.", variant: "default"});
            return;
        }
        if (waypoint && fileInputRef.current) {
            console.log("handleAddPhotoClickFromWaypoint: Triggering file input for waypoint:", waypoint.id);
             // Set context for potential fallback location
            setPhotoUploadWaypointContext({ id: waypoint.id, location: { lat: waypoint.lat, lng: waypoint.lng } });
            setActiveMarker(waypoint.id); // Keep the info window open or reopen it
            fileInputRef.current.click(); // Trigger native file input dialog
        } else {
             console.error("handleAddPhotoClickFromWaypoint: Waypoint or file input ref missing.");
             toast({ title: "Error", description: "Could not initiate photo upload.", variant: "destructive" });
        }
    };
    // Handles the file selection from the <input type="file">
    const handlePhotoFilesSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0 || !savedRouteId) {
            if (!savedRouteId) {
                toast({ title: "Save Route First", description: "Please save the route before uploading photos.", variant: "default" });
            }
            setPhotoUploadWaypointContext(null); // Clear context if no file selected or route not saved
            return;
        }

        setIsUploadingPhotos(true);
        toast({ title: "Processing Photos...", description: `Attempting to upload ${files.length} photo(s). This may take a moment.` });

        const fileArray = Array.from(files);
        const uploadResults = await Promise.all(
            fileArray.map(async (file) => {
                try {
                    // Read file as Data URL
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = (e) => reject("Failed to read file: " + e.target?.error?.message);
                        reader.readAsDataURL(file);
                    });

                    // Extract EXIF location
                    let photoLocation: Coordinates | null = null;
                    let locationSource: 'exif' | 'waypoint' = 'waypoint';
                    try {
                        photoLocation = await extractLocationFromPhoto(file);
                        locationSource = 'exif';
                    } catch {
                        if (photoUploadWaypointContext) {
                            photoLocation = photoUploadWaypointContext.location;
                        } else {
                            throw new Error("No EXIF data and no waypoint context available.");
                        }
                    }

                    // Prepare photo info
                    const photoInfo: Omit<Photo, 'url' | 'id'> = {
                        location: photoLocation!,
                        description: photoDescription || '',
                        waypointId: locationSource === 'waypoint' ? photoUploadWaypointContext?.id : undefined,
                        locationSource,
                    };

                    // Upload photo
                    const result = await uploadPhotoAction(dataUrl, savedRouteId, photoInfo);
                    if (result.success && result.photoId && result.photoUrl) {
                        setPhotos((prev) => [...prev, { id: result.photoId, url: result.photoUrl, ...photoInfo }]);
                        return { success: true };
                    } else {
                        throw new Error(result.error || "Unknown upload error");
                    }
                } catch (error: any) {
                    console.error(`Failed to upload photo ${file.name}:`, error);
                    return { success: false, error: error.message };
                }
            })
        );

        // Summarize results
        const photosAddedCount = uploadResults.filter((res) => res.success).length;
        const photosFailedCount = uploadResults.length - photosAddedCount;

        toast({
            title: photosAddedCount > 0 ? "Photo Upload Complete" : "Photo Upload Failed",
            description: photosAddedCount > 0
                ? `${photosAddedCount} photo(s) uploaded successfully. ${photosFailedCount > 0 ? `${photosFailedCount} failed.` : ''}`
                : `All ${photosFailedCount} photo(s) failed to upload.`,
            variant: photosFailedCount === 0 ? "success" : photosAddedCount > 0 ? "default" : "destructive",
        });

        // Clean up
        setIsUploadingPhotos(false);
        setPhotoUploadWaypointContext(null);
        setPhotoDescription('');
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Reset file input
        }
    }, [toast, savedRouteId, photoUploadWaypointContext, photoDescription]);


    // Removes a specific photo (from state and potentially backend)
    const removePhoto = (id: string) => {
        const photoToRemove = photos.find(p => p.id === id);
        if (!photoToRemove) return;

        setPhotos(prev => prev.filter(p => p.id !== id));
        if (activeMarker === id) {
            setActiveMarker(null); // Close info window if it was for this photo
        }

        // TODO: Add call to a server action to delete the photo from cloud storage
        // and remove its reference from the Route document in MongoDB.
        // Example: removePhotoAction(savedRouteId, id);

        toast({ title: "Photo Removed", description: "The photo has been removed locally. Ensure it's also deleted from storage if needed." });
        // Don't clear savedRouteId just for removing a photo, but the route *has* changed
        setSavedRouteId(null); // Indicate route needs saving again after photo removal
    };


    // Saves the current route to MongoDB via server action
    const handleSaveRoute = async () => {
        if (!routeName.trim()) {
            toast({ title: "Invalid Name", description: "Please enter a name for your route.", variant: "destructive" });
            return;
        }
        if (!origin || !destination) {
            toast({ title: "Missing Points", description: "Please set both an origin and a destination.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        // Use existing savedRouteId if available (for updates), otherwise generate a new one
        const routeIdToSave = savedRouteId || `route-${Date.now().toString().slice(-6)}-${Math.random().toString(16).slice(2, 6)}`;

        const routeData: StoredRouteData = {
            id: routeIdToSave, // Use generated or existing ID
            name: routeName,
            origin: origin!,
            destination: destination!,
            intermediateWaypoints,
            photos, // Send current photo metadata
             creatorId: 'temp_user_id' // Replace with actual user ID from auth context
        };

        try {
             // Call the server action (or API endpoint)
             const result = await saveRouteAction(routeData);

             if (result.success && result.routeId) {
                console.log("handleSaveRoute: Route saved/updated successfully with ID:", result.routeId);
                setSavedRouteId(result.routeId); // Update state with the confirmed ID

                toast({
                    title: "Route Saved!",
                    description: `Route "${routeName}" saved successfully.`,
                    variant: "success",
                    action: (
                        <Button variant="outline" size="sm" onClick={() => handleShareRoute(result.routeId!)}>
                            <Share2 className="mr-2 h-4 w-4" /> Share
                        </Button>
                    )
                });
             } else {
                 throw new Error(result.error || "Failed to save route");
             }

        } catch (error: any) {
            console.error("handleSaveRoute: Error saving route:", error);
            toast({
                title: "Save Failed",
                description: `Could not save the route. Details: ${error.error}`,
                variant: "destructive"
            });
             // Don't clear savedRouteId on failure if it was an update attempt
        } finally {
            setIsSaving(false);
        }
    };


    // Copies the sharing link for the currently saved route to the clipboard
    const handleShareRoute = (routeId: string | null) => {
        console.log("handleShareRoute: Received routeId:", routeId);
        if (!routeId) {
            console.warn("handleShareRoute: routeId is null. Cannot share.");
            toast({ title: "Save Route First", description: "Please save the route before sharing.", variant: "default" });
            return;
        }
        // Construct the URL based on the current window location and the saved route ID
        const shareUrl = `${window.location.origin}/view/${routeId}`;
        console.log("handleShareRoute: Constructed share URL:", shareUrl);

         // Check if the clipboard API is available
         if (!navigator.clipboard) {
            console.error("handleShareRoute: Clipboard API not supported in this browser.");
            toast({ title: "Copy Failed", description: "Your browser does not support the clipboard API.", variant: "destructive" });
            // Fallback: show the link in an alert or the toast
            toast({ title: "Share Link", description: `Copy this link: ${shareUrl}`, variant: "default", duration: 10000 });
            return;
        }
         navigator.clipboard.writeText(shareUrl)
            .then(() => {
                toast({ title: "Link Copied!", description: `Sharing link copied to clipboard.`, variant: "success"});
            })
            .catch(err => {
                console.error('handleShareRoute: Failed to copy share link:', err.message, err);
                toast({ title: "Copy Failed", description: "Could not copy the link automatically. Please copy it manually.", variant: "destructive" });
                 // Optionally show the link in the toast description or an alert
                 toast({ title: "Share Link", description: `Copy this link: ${shareUrl}`, variant: "default", duration: 10000 });
            });
    };


    // --- Getters for Active Info ---
    // Finds the currently active waypoint based on activeMarker state
    const getActiveWaypoint = (): Waypoint | null => {
        if (!activeMarker) return null;
        if (origin?.id === activeMarker) return origin;
        if (destination?.id === activeMarker) return destination;
        return intermediateWaypoints.find(wp => wp.id === activeMarker) || null;
    }

    // Finds the currently active photo based on activeMarker state
    const getActivePhoto = (): Photo | null => {
        if (!activeMarker) return null;
        return photos.find(p => p.id === activeMarker) || null;
    }


    // --- Render InfoWindow Content ---
    const renderActiveMarkerInfo = () => {
        const activeWaypoint = getActiveWaypoint();
        const activePhoto = getActivePhoto();

        // --- InfoWindow for Waypoints ---
        if (activeWaypoint) {
            const isOrigin = origin?.id === activeWaypoint.id;
            const isDestination = destination?.id === activeWaypoint.id;
            let waypointType = "Stop";
            if (isOrigin) waypointType = "Origin";
            else if (isDestination) waypointType = "Destination";

            return (
                <InfoWindow
                    position={activeWaypoint}
                    onCloseClick={handleInfoWindowClose}
                    headerDisabled // Use custom header/content below
                >
                    <div className="p-2 min-w-[250px] max-w-xs space-y-3">
                         {/* Header */}
                        <h4 className="text-md font-semibold flex items-center gap-2 border-b pb-2 mb-2">
                            {isOrigin && <LocateFixed className="w-4 h-4 text-primary" />}
                            {isDestination && <Flag className="w-4 h-4 text-destructive" />}
                            {!isOrigin && !isDestination && <MapPin className="w-4 h-4 text-muted-foreground" />}
                            {activeWaypoint.name || waypointType}
                        </h4>

                        {/* Details */}
                        {activeWaypoint.address && (
                            <p className="text-xs text-muted-foreground">{activeWaypoint.address}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Lat: {activeWaypoint.lat.toFixed(4)}, Lng: {activeWaypoint.lng.toFixed(4)}
                        </p>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-2 mt-2 border-t pt-3">
                             {/* Add Photo Button */}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddPhotoClickFromWaypoint(activeWaypoint)}
                                disabled={isUploadingPhotos || !savedRouteId} // Disable if uploading or route not saved yet
                                title={!savedRouteId ? "Save the route first" : "Add photo near this point"}
                            >
                                {isUploadingPhotos && photoUploadWaypointContext?.id === activeWaypoint.id ? (
                                     <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : (
                                     <Camera className="mr-1 h-4 w-4" />
                                )}
                                Add Photo
                            </Button>

                             {/* Remove Waypoint Button */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive" className="flex-grow sm:flex-grow-0">
                                        <Trash2 className="mr-1 h-4 w-4" /> Remove
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Remove {waypointType}?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to remove this {waypointType.toLowerCase()}? Photos linked directly to this waypoint (not from EXIF) will also be removed. This action may require saving the route again.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => removeWaypoint(activeWaypoint.id)} className="bg-destructive hover:bg-destructive/90">
                                            Remove
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>

                        {/* Photo Upload Description Input (only shows when upload is initiated from *this* waypoint) */}
                         {photoUploadWaypointContext?.id === activeWaypoint.id && (
                            <div className="mt-4 border-t pt-3 space-y-2">
                                <Label htmlFor={`photo-desc-${activeWaypoint.id}`} className="text-sm font-medium">Photo description (optional)</Label>
                                <Textarea
                                    id={`photo-desc-${activeWaypoint.id}`}
                                    placeholder="Add a caption for the photo(s)..."
                                    value={photoDescription}
                                    onChange={(e) => setPhotoDescription(e.target.value)}
                                    rows={2}
                                    className="text-sm"
                                />
                                {isUploadingPhotos && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin"/> Processing...
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground">Location will be extracted from photo if possible, otherwise waypoint location will be used.</p>
                            </div>
                        )}

                    </div>
                </InfoWindow>
            );
        }

        // --- InfoWindow for Photos ---
        if (activePhoto) {
             // Find linked waypoint ONLY if the photo location came from the waypoint
             const linkedWaypoint = activePhoto.locationSource === 'waypoint'
                ? [origin, destination, ...intermediateWaypoints]
                   .filter(Boolean)
                   .find(wp => wp?.id === activePhoto.waypointId)
                : null;

             return (
                <InfoWindow
                    position={activePhoto.location}
                    onCloseClick={handleInfoWindowClose}
                    headerDisabled // Use custom content
                >
                    <div className="p-2 max-w-xs space-y-2">
                        <h5 className="text-sm font-semibold mb-1 flex items-center gap-2 border-b pb-1">
                           <Camera className="w-4 h-4 text-accent"/> Photo Details
                        </h5>
                         {/* Image Preview */}
                        {activePhoto.url && (
                            <Image
                                src={activePhoto.url} // Use the URL from cloud storage
                                alt={activePhoto.description || 'Route photo'}
                                width={200} // Fixed width for consistency
                                height={150} // Fixed height
                                className="rounded-md mb-2 object-cover w-full max-h-[150px]" // Ensure it covers but doesn't exceed height
                            />
                        )}
                        {/* Description */}
                        {activePhoto.description && <p className="text-sm mb-1">{activePhoto.description}</p>}
                        {/* Location Info */}
                        <div className="text-xs text-muted-foreground mb-2 flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                                 <MapPin className="w-3 h-3 flex-shrink-0"/>
                                 <span>Lat: {activePhoto.location.lat.toFixed(4)}, Lng: {activePhoto.location.lng.toFixed(4)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="font-medium mr-1">Source:</span>
                                 <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${activePhoto.locationSource === 'exif' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'}`}>
                                    {activePhoto.locationSource.toUpperCase()}
                                </span>
                            </div>
                           {linkedWaypoint && (
                                <p className="text-xs text-muted-foreground">Linked to: {linkedWaypoint.name}</p>
                           )}
                        </div>

                        {/* Remove Photo Button */}
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" className="w-full">
                                    <Trash2 className="mr-1 h-4 w-4" /> Remove Photo
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Photo?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to remove this photo? This will delete it from the route and potentially from storage. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => removePhoto(activePhoto.id)} className="bg-destructive hover:bg-destructive/90">
                                        Remove
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </InfoWindow>
            );
        }

        return null; // No active marker
    };

   // Helper to get all waypoints (origin, intermediate, destination) for rendering markers
    const getAllWaypoints = (): Waypoint[] => {
        const points = [];
        if (origin) points.push(origin);
        points.push(...intermediateWaypoints);
        if (destination) points.push(destination);
        return points;
    };


  // --- Render ---
  return (
     // Main layout grid
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-8rem)]"> {/* Adjust height calc as needed */}

            {/* Map Area */}
            <div className="md:col-span-2 h-full rounded-lg overflow-hidden shadow-md border border-border">
                <Map
                    mapId={'route_snap_map_planner_v4'} // Update map ID if needed
                    defaultCenter={DEFAULT_CENTER}
                    defaultZoom={DEFAULT_ZOOM}
                    gestureHandling={'greedy'}
                    disableDefaultUI={true} // Keep default UI controls off
                    onClick={handleMapClick} // Add waypoints by clicking map
                    className="w-full h-full"
                    mapTypeControl={false}
                    streetViewControl={false}
                    fullscreenControl={false}
                >
                    {/* Waypoint Markers */}
                    {getAllWaypoints().map((waypoint, index) => {
                         const isOrigin = origin?.id === waypoint.id;
                         const isDestination = destination?.id === waypoint.id;
                         const intermediateIndex = intermediateWaypoints.findIndex(wp => wp.id === waypoint.id); // Find index ONLY in intermediates

                         const pinColor = isOrigin ? 'hsl(var(--primary))' : isDestination ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))';
                         const glyphColor = 'hsl(var(--primary-foreground))'; // White for all glyphs initially
                         const borderColor = 'hsl(var(--primary-foreground))'; // White border

                         // Determine the glyph inside the pin
                          let glyph: React.ReactNode;
                         if (isOrigin) {
                            glyph = <LocateFixed className="w-4 h-4" />;
                         } else if (isDestination) {
                             glyph = <Flag className="w-4 h-4" />;
                         } else {
                            // Display the 1-based index for intermediate waypoints
                             glyph = <span className="text-xs font-bold">{intermediateIndex + 1}</span>;
                         }

                         return (
                            <AdvancedMarker
                                key={waypoint.id}
                                position={waypoint}
                                onClick={() => handleMarkerClick(waypoint.id)}
                                title={waypoint.name || `Waypoint ${waypoint.id.slice(-4)}`} // Tooltip on hover
                                zIndex={activeMarker === waypoint.id ? 10 : 1} // Bring active marker to front
                            >
                                {/* Use ShadCN Pin component for styling */}
                                <Pin background={pinColor} glyphColor={glyphColor} borderColor={borderColor}>
                                    {glyph}
                                </Pin>
                            </AdvancedMarker>
                        );
                    })}

                    {/* Photo Markers */}
                    {photos.map((photo) => (
                        <AdvancedMarker
                            key={photo.id}
                            position={photo.location}
                            onClick={() => handleMarkerClick(photo.id)}
                            title={photo.description || "View Photo"}
                            zIndex={activeMarker === photo.id ? 10 : 1} // Bring active photo marker to front
                        >
                            {/* Custom styled photo marker */}
                            <div className={`p-1 rounded-full shadow-lg cursor-pointer transform transition-transform duration-150 ease-in-out ${activeMarker === photo.id ? 'scale-125 ring-2 ring-offset-1 ring-yellow-400' : 'hover:scale-110'} ${photo.locationSource === 'exif' ? 'bg-green-500 hover:bg-green-600' : 'bg-accent hover:bg-accent/90'}`}>
                                <Camera className="w-4 h-4 text-white" />
                            </div>
                        </AdvancedMarker>
                    ))}

                    {/* Active Marker InfoWindow */}
                    {renderActiveMarkerInfo()}

                </Map>
            </div>

      {/* Controls Area */}
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Plan Your Route</CardTitle>
           <CardDescription>Set points, add stops, save, and upload photos.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col gap-4 overflow-y-auto p-4"> {/* Make content scrollable */}
          {/* Route Name */}
          <div className="space-y-1">
            <Label htmlFor="routeName">Route Name</Label>
            <Input
              id="routeName"
              value={routeName}
              onChange={(e) => { setRouteName(e.target.value); setSavedRouteId(null); }} // Invalidate saved ID on name change
              placeholder="e.g., Scenic Coastal Drive"
            />
          </div>

          {/* Origin Input */}
          <div className="space-y-1">
            <Label htmlFor="originLocation" className="flex items-center gap-1">
                <LocateFixed className="w-4 h-4 text-primary"/> Origin
            </Label>
            <div className="flex items-center gap-1">
                <Input
                id="originLocation"
                ref={originAutocompleteInputRef}
                placeholder="Search or click map for start point"
                className="border-blue-300 focus:border-primary focus:ring-primary flex-grow"
                />
                {origin && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeWaypoint(origin!.id)} title="Remove Origin">
                        <Trash2 className="h-4 w-4"/> <span className="sr-only">Remove Origin</span>
                    </Button>
                )}
            </div>
            {origin && (
                <p className="text-xs text-muted-foreground p-1 truncate" title={origin.address}>{origin.name}</p>
            )}
          </div>

          {/* Destination Input */}
          <div className="space-y-1">
            <Label htmlFor="destinationLocation" className="flex items-center gap-1">
                <Flag className="w-4 h-4 text-destructive"/> Destination
            </Label>
             <div className="flex items-center gap-1">
                <Input
                id="destinationLocation"
                ref={destinationAutocompleteInputRef}
                placeholder="Search or click map for end point"
                className="border-red-300 focus:border-destructive focus:ring-destructive flex-grow"
                />
                {destination && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeWaypoint(destination!.id)} title="Remove Destination">
                        <Trash2 className="h-4 w-4"/> <span className="sr-only">Remove Destination</span>
                    </Button>
                )}
             </div>
             {destination && (
                 <p className="text-xs text-muted-foreground p-1 truncate" title={destination.address}>{destination.name}</p>
            )}
          </div>

          {/* Add Intermediate Waypoint */}
          <div className="space-y-1">
            <Label htmlFor="intermediateLocation" className="flex items-center gap-1">
                <PlusCircle className="w-4 h-4 text-muted-foreground"/> Add Stop / Waypoint
            </Label>
            <Input
              id="intermediateLocation"
              ref={intermediateAutocompleteInputRef}
              placeholder="Search or click map for stops"
              disabled={intermediateWaypoints.length >= MAX_INTERMEDIATE_WAYPOINTS}
              className="border-gray-300 focus:border-muted-foreground focus:ring-muted-foreground"
            />
             {intermediateWaypoints.length >= MAX_INTERMEDIATE_WAYPOINTS && (
                <p className="text-xs text-destructive">Maximum intermediate stops reached.</p>
            )}
          </div>

           {/* Intermediate Waypoints List */}
          <div className="space-y-2 flex-grow overflow-y-auto min-h-[100px]"> {/* Allow list to grow and scroll */}
            <Label>Stops ({intermediateWaypoints.length}/{MAX_INTERMEDIATE_WAYPOINTS})</Label>
            {intermediateWaypoints.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No stops added yet.</p>}
            <ul className="space-y-2">
               {intermediateWaypoints.map((wp, index) => (
                <li key={wp.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md text-sm">
                   <div className="flex items-center gap-2 overflow-hidden"> {/* Prevent long names from breaking layout */}
                     {/* Numbered circle for intermediate stops */}
                     <span className="flex-shrink-0 w-5 h-5 bg-muted-foreground text-background rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</span>
                     {/* Waypoint name, truncated */}
                     <span className="truncate" title={wp.address || wp.name}>{wp.name}</span>
                  </div>
                   {/* Remove button */}
                   <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeWaypoint(wp.id)} title="Remove Stop">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove Stop</span>
                   </Button>
                </li>
              ))}
            </ul>
          </div>

            {/* Upload Photos Section - Enabled only after saving */}
            <div className="space-y-1 border-t pt-4">
                 <Label
                    htmlFor="photoUploadTrigger"
                    className={`flex items-center gap-1 transition-colors ${!savedRouteId ? 'text-muted-foreground cursor-not-allowed' : 'cursor-pointer hover:text-primary'}`}
                    title={!savedRouteId ? "Save the route first to enable photo uploads" : "Upload photos for this route"}
                  >
                    <Upload className="w-4 h-4"/> Upload Photos
                 </Label>
                  {/* Hidden actual file input */}
                 <input
                     type="file"
                     id="photoUploadInput" // Different ID from label's htmlFor
                     ref={fileInputRef}
                     onChange={handlePhotoFilesSelected} // Use the consolidated handler
                     accept="image/jpeg, image/png, image/gif" // Specify accepted types
                     style={{ display: 'none' }} // Keep it hidden
                     multiple // Allow selecting multiple photos
                     disabled={!savedRouteId || isUploadingPhotos} // Disable if not saved or uploading
                 />
                  {/* Button that *looks* like the uploader, triggers the hidden input */}
                  <Button
                    id="photoUploadTrigger" // Match Label's htmlFor
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-muted-foreground"
                    onClick={() => fileInputRef.current?.click()} // Click the hidden input
                    disabled={!savedRouteId || isUploadingPhotos} // Disable while uploads are in progress or not saved
                    title={!savedRouteId ? "Save the route first to enable photo uploads" : "Select photos"}
                    >
                       {isUploadingPhotos ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                            </>
                        ) : (
                            <>
                                <Camera className="mr-2 h-4 w-4" /> Select photos to add...
                            </>
                        )}
                  </Button>
                 <p className="text-xs text-muted-foreground mt-1">
                    {savedRouteId ? "EXIF location data will be used if available." : "Save route to upload photos."}
                 </p>
                 {/* Display uploaded photos preview */}
                 {photos.length > 0 && (
                     <div className="mt-2 space-y-1">
                        <Label className="text-xs">Added Photos ({photos.length})</Label>
                        <div className="grid grid-cols-4 gap-2 max-h-24 overflow-y-auto p-1 border rounded-md">
                            {photos.map(p => (
                                <div key={p.id} className="relative aspect-square group">
                                    <Image src={p.url} alt={p.description || `Photo ${p.id.slice(-4)}`} fill sizes="10vw" className="object-cover rounded" />
                                     <Button
                                         variant="destructive"
                                         size="icon"
                                         className="absolute top-0.5 right-0.5 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity z-10" // Ensure button is clickable
                                         onClick={() => removePhoto(p.id)}
                                         title="Remove Photo"
                                     >
                                         <Trash2 className="h-2.5 w-2.5"/>
                                         <span className="sr-only">Remove Photo</span>
                                     </Button>
                                </div>
                            ))}
                        </div>
                     </div>
                 )}
            </div>


           {/* Action Buttons */}
          <div className="mt-auto flex flex-col gap-2 pt-4 border-t"> {/* Stick to bottom */}
             <Button onClick={handleSaveRoute} disabled={isSaving || !origin || !destination}>
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> {savedRouteId ? 'Update Route' : 'Save Route'}</>}
             </Button>
             <Button variant="outline" onClick={() => handleShareRoute(savedRouteId)} disabled={isSaving || !savedRouteId}>
               <Share2 className="mr-2 h-4 w-4" /> Share Saved Route
             </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
