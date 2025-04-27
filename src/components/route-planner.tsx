
'use client'

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
import { Share2, Save, MapPin, Camera, Upload, Trash2, LocateFixed, Flag, PlusCircle } from 'lucide-react';
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
  id: string;
  url: string; // Base64 or remote URL
  location: Coordinates;
  waypointId?: string; // Link photo to a waypoint (Origin, Dest, or Intermediate ID)
  description?: string
}

// Keep RouteData simple for saving; origin/dest are just special waypoints
interface StoredRouteData {
  id: string;
  name: string;
  origin: Waypoint;
  destination: Waypoint;
  intermediateWaypoints: Waypoint[];
  photos: Photo[];
  // Storing full directions result might be large and prone to becoming outdated.
  // It's often better to recalculate on load if needed.
  // directionsResultJson?: string; // Optional: Store stringified DirectionsResult
}

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
  const [photos, setPhotos] = useState<Photo[]>([])
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [activeMarker, setActiveMarker] = useState<string | null>(null) // Waypoint ID (Origin, Dest, or Intermediate) or Photo ID
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null)
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showPhotoUpload, setShowPhotoUpload] = useState<Coordinates | null>(null)
  const [photoDescription, setPhotoDescription] = useState('')
  const [photoWaypointId, setPhotoWaypointId] = useState<string | null>(null) // Track which waypoint photo is being added to
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

    const initializeAutocomplete = useCallback((
        inputRef: React.RefObject<HTMLInputElement>,
        setter: React.Dispatch<React.SetStateAction<google.maps.places.Autocomplete | null>>,
        onPlaceChanged: (place: google.maps.places.PlaceResult) => void
      ) => {
        if (!placesLib || !inputRef.current) return null; // Return null if setup fails

        const options = {
          fields: ["formatted_address", "geometry", "name"],
          strictBounds: false, // Be more flexible
        };

        const ac = new placesLib.Autocomplete(inputRef.current, options);
        ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            if (place.geometry?.location) {
               onPlaceChanged(place);
            } else {
                 toast({ title: "Location not found", description: "Could not find coordinates for the selected place.", variant: "destructive" });
            }
             // Clear input after selection for intermediate waypoints only
            if (inputRef === intermediateAutocompleteInputRef && inputRef.current) {
                inputRef.current.value = '';
            }
        });
         setter(ac); // Set the autocomplete instance in state
         return ac; // Return the instance
      }, [placesLib, toast]);


      // Initialize Autocompletes
    useEffect(() => {
        const acOrigin = initializeAutocomplete(originAutocompleteInputRef, setOriginAutocomplete, (place) => handleSetOrigin(place));
        const acDest = initializeAutocomplete(destinationAutocompleteInputRef, setDestinationAutocomplete, (place) => handleSetDestination(place));
        const acInter = initializeAutocomplete(intermediateAutocompleteInputRef, setIntermediateAutocomplete, (place) => {
           if (place.geometry?.location) {
                addIntermediateWaypoint(place.geometry.location.lat(), place.geometry.location.lng(), place.name, place.formatted_address);
           }
        });

        // Cleanup listeners on unmount
        return () => {
          if (window.google && window.google.maps) {
             if (acOrigin) window.google.maps.event.clearInstanceListeners(acOrigin);
             if (acDest) window.google.maps.event.clearInstanceListeners(acDest);
             if (acInter) window.google.maps.event.clearInstanceListeners(acInter);
          }
        };
        // Re-run if libraries load, but not on handler changes
      }, [placesLib, initializeAutocomplete]);


  // Update directions when origin, destination, or intermediate waypoints change
  useEffect(() => {
    if (!directionsService || !directionsRenderer || !origin || !destination) {
      directionsRenderer?.setDirections(null); // Clear route if no origin/dest
      setDirections(null);
      return;
    }

    const waypoints = intermediateWaypoints.map(wp => ({
        location: { lat: wp.lat, lng: wp.lng },
        stopover: true
    }));

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
          directionsRenderer.setDirections(result);
          setDirections(result);
        } else {
          console.error(`Directions request failed due to ${status}`);
          toast({ title: "Routing Error", description: `Could not calculate the route. ${status}`, variant: "destructive" });
          directionsRenderer.setDirections(null);
          setDirections(null);
        }
      }
    );
    // Dependency array includes all route points
  }, [origin, destination, intermediateWaypoints, directionsService, directionsRenderer, toast]);


  // --- Handlers ---

  const createWaypoint = (place: google.maps.places.PlaceResult): Waypoint | null => {
    if (!place.geometry?.location) return null;
    return {
        id: `wp-${Date.now()}-${Math.random().toString(16).slice(2)}`, // More unique ID
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        name: place.name || "Selected Location",
        address: place.formatted_address || "Coordinates: " + place.geometry.location.lat().toFixed(5) + ", " + place.geometry.location.lng().toFixed(5)
    };
  }

  const handleSetOrigin = useCallback((place: google.maps.places.PlaceResult) => { // Wrapped in useCallback
     const newOrigin = createWaypoint(place);
     if (newOrigin) {
        setOrigin(newOrigin);
        map?.panTo({ lat: newOrigin.lat, lng: newOrigin.lng });
        if (originAutocompleteInputRef.current && place.formatted_address) {
            originAutocompleteInputRef.current.value = place.formatted_address; // Update input field
        }
        setActiveMarker(newOrigin.id);
     }
  }, [map]); // Dependency: map instance

  const handleSetDestination = useCallback((place: google.maps.places.PlaceResult) => { // Wrapped in useCallback
     const newDest = createWaypoint(place);
     if (newDest) {
        setDestination(newDest);
        map?.panTo({ lat: newDest.lat, lng: newDest.lng });
        if (destinationAutocompleteInputRef.current && place.formatted_address) {
             destinationAutocompleteInputRef.current.value = place.formatted_address; // Update input field
        }
         setActiveMarker(newDest.id);
     }
  }, [map]); // Dependency: map instance

   const addIntermediateWaypoint = useCallback((lat: number, lng: number, name?: string, address?: string) => { // Wrapped in useCallback
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
  }, [intermediateWaypoints.length, toast, map]); // Dependencies: length, toast, map


  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return

    if (!origin) {
        // Set Origin if empty
        handleSetOrigin({
            geometry: { location: event.latLng },
            name: "Selected Location",
            formatted_address: "Dropped Pin" // Or use reverse geocoding later
        });
        toast({ title: "Origin Set", description: "Starting point added by clicking the map." });
    } else if (!destination) {
         // Set Destination if empty and origin is set
        handleSetDestination({
            geometry: { location: event.latLng },
            name: "Selected Location",
            formatted_address: "Dropped Pin"
        });
        toast({ title: "Destination Set", description: "Ending point added by clicking the map." });
    } else {
         // Add Intermediate Waypoint if origin & dest are set
        if (intermediateWaypoints.length >= MAX_INTERMEDIATE_WAYPOINTS) {
            toast({ title: "Waypoint Limit Reached", description: `You can add a maximum of ${MAX_INTERMEDIATE_WAYPOINTS} intermediate waypoints.`, variant: "destructive" });
            return;
        }
         addIntermediateWaypoint(event.latLng.lat(), event.latLng.lng(), "Added Waypoint", "Dropped Pin");
         toast({ title: "Waypoint Added", description: "Intermediate point added by clicking the map." });
    }

  }, [origin, destination, intermediateWaypoints, toast, handleSetOrigin, handleSetDestination, addIntermediateWaypoint]); // Added missing dependencies


  const removeWaypoint = (id: string) => {
    if (origin?.id === id) {
        setOrigin(null);
        if (originAutocompleteInputRef.current) originAutocompleteInputRef.current.value = '';
         toast({ title: "Origin Removed"});
    } else if (destination?.id === id) {
        setDestination(null);
        if (destinationAutocompleteInputRef.current) destinationAutocompleteInputRef.current.value = '';
         toast({ title: "Destination Removed"});
    } else {
        setIntermediateWaypoints(prev => prev.filter(wp => wp.id !== id));
         toast({ title: "Waypoint Removed"});
    }

    if (activeMarker === id) {
      setActiveMarker(null);
    }
    // Also remove associated photos
    setPhotos(prev => prev.filter(p => p.waypointId !== id));
     setSavedRouteId(null); // Clear saved ID if route changes
  };

  const handleMarkerClick = (id: string) => {
    setActiveMarker(id);
    // Find the marker's coordinates and pan the map
    const allWaypoints = [origin, destination, ...intermediateWaypoints].filter(Boolean) as Waypoint[];
    const marker = allWaypoints.find(wp => wp.id === id) || photos.find(p => p.id === id);
    if (marker && map) { // Check if map exists
      const position = 'location' in marker ? marker.location : marker; // Check if photo or waypoint
      map.panTo(position);
    }
  };

  const handleInfoWindowClose = () => {
    setActiveMarker(null);
    setShowPhotoUpload(null);
    setPhotoDescription('');
    setPhotoWaypointId(null);
  };


   const handleAddPhotoClick = (waypointId: string) => {
        const allWaypoints = [origin, destination, ...intermediateWaypoints].filter(Boolean) as Waypoint[];
        const waypoint = allWaypoints.find(wp => wp.id === waypointId);

        if (waypoint && fileInputRef.current) {
          setShowPhotoUpload({ lat: waypoint.lat, lng: waypoint.lng });
          setPhotoWaypointId(waypointId); // Link photo being uploaded to this waypoint
          fileInputRef.current.click(); // Trigger file input immediately
        } else {
             toast({ title: "Error", description: "Could not find waypoint to add photo.", variant: "destructive" });
        }
  };


  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!showPhotoUpload || !photoWaypointId || !event.target.files || event.target.files.length === 0) {
        // If the context was lost (e.g., user closed InfoWindow before selecting file), show error
        if (!showPhotoUpload || !photoWaypointId) {
            toast({ title: "Upload Cancelled", description: "Waypoint context lost. Please click 'Add Photo' on the waypoint again.", variant: "destructive"});
        }
         // Reset file input if needed
        if (event.target) event.target.value = '';
        return;
    }


    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onloadend = () => {
      const newPhoto: Photo = {
        id: `photo-${Date.now()}`,
        url: reader.result as string, // Base64 URL
        location: showPhotoUpload, // Use the coordinates stored when 'Add Photo' was clicked
        description: photoDescription,
        waypointId: photoWaypointId // Assign waypoint ID
      };
      setPhotos(prev => [...prev, newPhoto]);
      toast({ title: "Photo Added", description: "Your photo has been tagged to the waypoint." });

      // Don't close info window automatically, let user add description if they want.
      // Reset state for the next potential upload from the same window.
      setPhotoDescription('');
      // setPhotoWaypointId(null); // Clear linked waypoint ID after successful upload // Keep waypointId for info window context
      // setShowPhotoUpload(null); // Hide the description/upload button area in the InfoWindow temporarily? No, keep it open maybe.
      setActiveMarker(activeMarker); // Keep the same marker active


       // Explicitly reset file input value here
       if (fileInputRef.current) {
         fileInputRef.current.value = '';
       }
    };

     reader.onerror = () => {
        toast({ title: "File Read Error", description: "Could not read the selected file.", variant: "destructive" });
         if (fileInputRef.current) {
           fileInputRef.current.value = '';
         }
    };

    reader.readAsDataURL(file); // Read file as Base64
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
     if (activeMarker === id) {
      setActiveMarker(null);
    }
    toast({ title: "Photo Removed", description: "The photo has been removed from the route." });
    setSavedRouteId(null); // Clear saved ID if route changes
  };


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
    // Generate a more predictable ID for mocking/testing
    const generatedRouteId = `route-${Date.now().toString().slice(0, 10)}`; // Use first 10 digits of timestamp for consistency


    const routeData: StoredRouteData = {
        id: generatedRouteId, // Use generated ID
        name: routeName,
        origin,
        destination,
        intermediateWaypoints,
        photos,
        // Optionally store directions, e.g., JSON.stringify(directions)
    };

    // --- Save to localStorage ---
    try {
        localStorage.setItem(`route_${generatedRouteId}`, JSON.stringify(routeData));
        console.log("Route Saved to localStorage:", routeData); // Log success
        setSavedRouteId(generatedRouteId); // Store the generated ID

         toast({
          title: "Route Saved!",
          description: `Route "${routeName}" saved locally.`,
          action: (
             <Button variant="outline" size="sm" onClick={() => handleShareRoute(generatedRouteId)}>
                <Share2 className="mr-2 h-4 w-4" /> Share
             </Button>
          )
        });

    } catch (error) {
        console.error("Error saving route to localStorage:", error);
        toast({
            title: "Save Failed",
            description: "Could not save the route locally. Storage might be full or restricted.",
            variant: "destructive"
        });
         setSavedRouteId(null); // Clear ID on failure
    } finally {
         setIsSaving(false);
    }
    // --- End localStorage Save ---
  };

   const handleShareRoute = (routeId: string | null) => {
     if (!routeId) {
       toast({ title: "Save Route First", description: "Please save the route before sharing.", variant: "destructive" });
       return;
     }
     // In a real app, use the actual saved route ID from Firebase/backend
    const shareUrl = `${window.location.origin}/view/${routeId}`; // Example URL structure
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        toast({ title: "Link Copied!", description: `Sharing link for route ${routeId} copied.` });
      })
      .catch(err => {
        console.error('Failed to copy share link:', err);
        toast({ title: "Copy Failed", description: "Could not copy the link.", variant: "destructive" });
      });
  };


  // --- Getters for Active Info ---
  const getActiveWaypoint = (): Waypoint | null => {
     if (!activeMarker) return null;
     if (origin?.id === activeMarker) return origin;
     if (destination?.id === activeMarker) return destination;
     return intermediateWaypoints.find(wp => wp.id === activeMarker) || null;
  }

  const getActivePhoto = (): Photo | null => {
     if (!activeMarker) return null;
     return photos.find(p => p.id === activeMarker) || null;
  }


   // --- Render InfoWindow Content ---
   const renderActiveMarkerInfo = () => {
    const activeWaypoint = getActiveWaypoint();
    const activePhoto = getActivePhoto();

    if (activeWaypoint) {
      const isOrigin = origin?.id === activeWaypoint.id;
      const isDestination = destination?.id === activeWaypoint.id;
      let waypointType = "Waypoint";
      if (isOrigin) waypointType = "Origin";
      else if (isDestination) waypointType = "Destination";

      return (
        <InfoWindow
          position={activeWaypoint}
          onCloseClick={handleInfoWindowClose}
          headerDisabled // Use custom header/content
        >
          <div className="p-2 min-w-[250px] max-w-xs space-y-3">
            <h4 className="text-md font-semibold flex items-center gap-2">
               {isOrigin && <LocateFixed className="w-4 h-4 text-primary" />}
               {isDestination && <Flag className="w-4 h-4 text-destructive" />}
               {!isOrigin && !isDestination && <MapPin className="w-4 h-4 text-muted-foreground" />}
               {activeWaypoint.name || waypointType}
            </h4>
            {activeWaypoint.address && (
                 <p className="text-xs text-muted-foreground">{activeWaypoint.address}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Lat: {activeWaypoint.lat.toFixed(4)}, Lng: {activeWaypoint.lng.toFixed(4)}
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => handleAddPhotoClick(activeWaypoint.id)}>
                <Camera className="mr-1 h-4 w-4" /> Add Photo
              </Button>
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
                      Are you sure you want to remove this {waypointType.toLowerCase()} and its associated photos? This action cannot be undone.
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

             {/* Photo Upload UI (Only appears if waypointId matches this active waypoint) */}
             {photoWaypointId === activeWaypoint.id && (
                <div className="mt-4 border-t pt-3 space-y-2">
                  <h5 className="text-sm font-medium">Add description for new photo:</h5>
                  <Textarea
                    placeholder="Description (optional)"
                    value={photoDescription}
                    onChange={(e) => setPhotoDescription(e.target.value)}
                  />
                  {/* Upload is triggered by handleAddPhotoClick, confirmation happens in handlePhotoUpload */}
                   <p className="text-xs text-muted-foreground">Select a photo file to upload.</p>
                </div>
              )}

          </div>
        </InfoWindow>
      );
    }

    if (activePhoto) {
       const linkedWaypoint = [origin, destination, ...intermediateWaypoints]
          .filter(Boolean)
          .find(wp => wp?.id === activePhoto.waypointId);

       return (
        <InfoWindow
          position={activePhoto.location}
          onCloseClick={handleInfoWindowClose}
          headerDisabled
        >
           <div className="p-2 max-w-xs space-y-2">
             <h5 className="text-sm font-semibold mb-1">Photo</h5>
             {activePhoto.url && (
                <Image
                    src={activePhoto.url}
                    alt={activePhoto.description || 'Route photo'}
                    width={200}
                    height={150}
                    className="rounded-md mb-2 object-cover w-full"
                 />
             )}
             {activePhoto.description && <p className="text-sm mb-2">{activePhoto.description}</p>}
            {linkedWaypoint && (
                <p className="text-xs text-muted-foreground">Linked to: {linkedWaypoint.name}</p>
            )}
            <p className="text-xs text-muted-foreground mb-2">
                Lat: {activePhoto.location.lat.toFixed(4)}, Lng: {activePhoto.location.lng.toFixed(4)}
             </p>
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                        <Trash2 className="mr-1 h-4 w-4" /> Remove Photo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Photo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove this photo? This action cannot be undone.
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

    return null;
  };

   // Helper to get all waypoints for marker rendering
    const getAllWaypoints = (): Waypoint[] => {
        const points = [];
        if (origin) points.push(origin);
        points.push(...intermediateWaypoints);
        if (destination) points.push(destination);
        return points;
    };


  // --- Render ---
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-8rem)]"> {/* Adjust height calc */}
            {/* Map Area */}
            <div className="md:col-span-2 h-full rounded-lg overflow-hidden shadow-md border border-border">
                <Map
                    mapId={'route_snap_map_v2'} // Unique ID
                    defaultCenter={DEFAULT_CENTER}
                    defaultZoom={DEFAULT_ZOOM}
                    gestureHandling={'greedy'}
                    disableDefaultUI={true} // Keep it clean
                    onClick={handleMapClick} // Handles adding points
                    className="w-full h-full"
                    mapTypeControl={false}
                    streetViewControl={false}
                    fullscreenControl={false}
                >
                    {/* Waypoint Markers */}
                    {getAllWaypoints().map((waypoint, index) => {
                         const isOrigin = origin?.id === waypoint.id;
                         const isDestination = destination?.id === waypoint.id;
                         const isIntermediate = !isOrigin && !isDestination;
                         // Correctly find the index for intermediate waypoints
                         const intermediateIndex = intermediateWaypoints.findIndex(wp => wp.id === waypoint.id);

                         const pinColor = isOrigin ? 'hsl(var(--primary))' : isDestination ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))'; // Use theme colors
                         const glyph = isOrigin ? <LocateFixed className="w-4 h-4 text-primary-foreground"/> : isDestination ? <Flag className="w-4 h-4 text-destructive-foreground"/> : <span className="text-xs font-bold text-white">{intermediateIndex + 1}</span>;


                         return (
                            <AdvancedMarker
                            key={waypoint.id}
                            position={waypoint}
                            onClick={() => handleMarkerClick(waypoint.id)}
                            title={waypoint.name || `Waypoint ${index + 1}`} // Tooltip on hover
                            >
                                <Pin background={pinColor} glyphColor={'hsl(var(--primary-foreground))'} borderColor={'hsl(var(--primary-foreground))'}>
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
                        >
                        <div className="p-1 bg-accent rounded-full shadow-md cursor-pointer transform hover:scale-110 transition-transform">
                            <Camera className="w-4 h-4 text-accent-foreground" />
                        </div>
                        </AdvancedMarker>
                    ))}

                    {/* Active Marker InfoWindow */}
                    {renderActiveMarkerInfo()}

                    {/* DirectionsRenderer handles drawing the route line - initialized in useEffect */}

                </Map>
            </div>

      {/* Controls Area */}
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Plan Your Route</CardTitle>
           <CardDescription>Set origin, destination, and add stops.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col gap-4 overflow-y-auto p-4">
          {/* Route Name */}
          <div className="space-y-1">
            <Label htmlFor="routeName">Route Name</Label>
            <Input
              id="routeName"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g., Scenic Coastal Drive"
            />
          </div>

          {/* Origin Input */}
          <div className="space-y-1">
            <Label htmlFor="originLocation" className="flex items-center gap-1">
                <LocateFixed className="w-4 h-4 text-primary"/> Origin
            </Label>
            <Input
              id="originLocation"
              ref={originAutocompleteInputRef}
              placeholder="Search or click map for start point"
              className="border-blue-300 focus:border-primary focus:ring-primary"
            />
            {origin && (
                <div className="text-xs text-muted-foreground p-1 flex justify-between items-center">
                    <span className="truncate pr-2" title={origin.address}>{origin.name}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => removeWaypoint(origin!.id)}>
                        <Trash2 className="h-3 w-3"/> <span className="sr-only">Remove Origin</span>
                    </Button>
                </div>
            )}
          </div>

          {/* Destination Input */}
          <div className="space-y-1">
            <Label htmlFor="destinationLocation" className="flex items-center gap-1">
                <Flag className="w-4 h-4 text-destructive"/> Destination
            </Label>
            <Input
              id="destinationLocation"
              ref={destinationAutocompleteInputRef}
              placeholder="Search or click map for end point"
               className="border-red-300 focus:border-destructive focus:ring-destructive"
            />
             {destination && (
                <div className="text-xs text-muted-foreground p-1 flex justify-between items-center">
                   <span className="truncate pr-2" title={destination.address}>{destination.name}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => removeWaypoint(destination!.id)}>
                        <Trash2 className="h-3 w-3"/> <span className="sr-only">Remove Destination</span>
                    </Button>
                </div>
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
                <p className="text-xs text-destructive">Maximum intermediate waypoints reached.</p>
            )}
          </div>

           {/* Intermediate Waypoints List */}
          <div className="space-y-2 flex-grow min-h-[100px]"> {/* Ensure list has some min height */}
            <Label>Stops ({intermediateWaypoints.length}/{MAX_INTERMEDIATE_WAYPOINTS})</Label>
            {intermediateWaypoints.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No stops added yet.</p>}
            <ul className="space-y-2">
               {intermediateWaypoints.map((wp, index) => (
                <li key={wp.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md text-sm">
                   <div className="flex items-center gap-2 overflow-hidden">
                     <span className="flex-shrink-0 w-5 h-5 bg-muted-foreground text-background rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</span>
                     <span className="truncate" title={wp.address || wp.name}>{wp.name}</span>
                  </div>
                   <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeWaypoint(wp.id)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove Waypoint</span>
                   </Button>
                </li>
              ))}
            </ul>
          </div>

           {/* Action Buttons */}
          <div className="mt-auto flex flex-col gap-2 pt-4 border-t">
             <Button onClick={handleSaveRoute} disabled={isSaving || !origin || !destination}>
                {isSaving ? 'Saving...' : <><Save className="mr-2 h-4 w-4" /> Save Route</>}
             </Button>
             {/* Share button now uses the savedRouteId state */}
             <Button variant="outline" onClick={() => handleShareRoute(savedRouteId)} disabled={isSaving || !savedRouteId}>
               <Share2 className="mr-2 h-4 w-4" /> Share Route
             </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden file input for photo uploads */}
       <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            accept="image/*"
            style={{ display: 'none' }}
        />
    </div>
  );
}

