'use client';

import type { Coordinates } from '@/types/maps';
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Share2, Save, MapPin, Camera, Upload, Trash2 } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"


// --- Constants ---
const DEFAULT_CENTER: Coordinates = { lat: 37.7749, lng: -122.4194 }; // San Francisco
const DEFAULT_ZOOM = 12;
const MAX_WAYPOINTS = 10; // Limit number of waypoints for performance/API usage

// --- Interfaces ---
interface Waypoint extends Coordinates {
  id: string;
  name?: string; // Optional name for the waypoint
}

interface Photo {
  id: string;
  url: string;
  location: Coordinates;
  waypointId?: string; // Link photo to a waypoint
  description?: string;
}

interface RouteData {
  id: string;
  name: string;
  waypoints: Waypoint[];
  photos: Photo[];
  directions?: google.maps.DirectionsResult | null;
}

// --- Component ---
export function RoutePlanner() {
  const map = useMap();
  const mapsLib = useMapsLibrary('routes');
  const placesLib = useMapsLibrary('places');
  const { toast } = useToast();

  const [routeName, setRouteName] = useState<string>('My Awesome Route');
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null); // Waypoint or Photo ID
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState<Coordinates | null>(null);
  const [photoDescription, setPhotoDescription] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autocompleteInputRef = useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);


  // --- Effects ---

  // Initialize Directions Service and Renderer
  useEffect(() => {
    if (!mapsLib || !map) return;
    setDirectionsService(new mapsLib.DirectionsService());
    setDirectionsRenderer(new mapsLib.DirectionsRenderer({ map, suppressMarkers: true })); // Suppress default markers
  }, [mapsLib, map]);

  // Initialize Places Autocomplete
  useEffect(() => {
    if (!placesLib || !autocompleteInputRef.current || autocomplete) return;

    const options = {
        fields: ["formatted_address", "geometry", "name"],
        strictBounds: false,
      };

    const ac = new placesLib.Autocomplete(autocompleteInputRef.current, options);
    setAutocomplete(ac);

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place.geometry?.location) {
        addWaypoint(place.geometry.location.lat(), place.geometry.location.lng(), place.name);
        if (autocompleteInputRef.current) {
            autocompleteInputRef.current.value = ''; // Clear input after selection
        }
      } else {
        toast({ title: "Location not found", description: "Could not find coordinates for the selected place.", variant: "destructive" });
      }
    });

    // Cleanup listener on unmount
    return () => {
      if (window.google && window.google.maps && autocomplete) {
           window.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };

  }, [placesLib, autocomplete, map]); // Add map dependency to re-bind if map changes

  // Update directions when waypoints change
  useEffect(() => {
    if (!directionsService || !directionsRenderer || waypoints.length < 2) {
      directionsRenderer?.setDirections(null); // Clear route if fewer than 2 waypoints
      setDirections(null);
      return;
    }

    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const intermediateWaypoints = waypoints
      .slice(1, -1)
      .map(wp => ({ location: { lat: wp.lat, lng: wp.lng }, stopover: true }));

    directionsService.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        waypoints: intermediateWaypoints,
        travelMode: google.maps.TravelMode.DRIVING, // Or other modes
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
  }, [waypoints, directionsService, directionsRenderer, toast]);


  // --- Handlers ---

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    if (waypoints.length >= MAX_WAYPOINTS) {
      toast({ title: "Waypoint Limit Reached", description: `You can add a maximum of ${MAX_WAYPOINTS} waypoints.`, variant: "destructive" });
      return;
    }
    addWaypoint(event.latLng.lat(), event.latLng.lng());
  }, [waypoints, toast]);

  const addWaypoint = (lat: number, lng: number, name?: string) => {
     if (waypoints.length >= MAX_WAYPOINTS) {
      toast({ title: "Waypoint Limit Reached", description: `You can add a maximum of ${MAX_WAYPOINTS} waypoints.`, variant: "destructive" });
      return;
    }
    const newWaypoint: Waypoint = { id: `wp-${Date.now()}`, lat, lng, name: name ?? `Waypoint ${waypoints.length + 1}` };
    setWaypoints(prev => [...prev, newWaypoint]);
    setActiveMarker(newWaypoint.id); // Make the new marker active
    map?.panTo({ lat, lng });
  }

  const removeWaypoint = (id: string) => {
    setWaypoints(prev => prev.filter(wp => wp.id !== id));
    if (activeMarker === id) {
      setActiveMarker(null);
    }
    // Also remove associated photos
    setPhotos(prev => prev.filter(p => p.waypointId !== id));
  };

  const handleMarkerClick = (id: string) => {
    setActiveMarker(id);
  };

  const handleInfoWindowClose = () => {
    setActiveMarker(null);
    setShowPhotoUpload(null);
    setPhotoDescription('');
  };

   const handleAddPhotoClick = (waypointId: string) => {
    const waypoint = waypoints.find(wp => wp.id === waypointId);
    if (waypoint) {
      setShowPhotoUpload({ lat: waypoint.lat, lng: waypoint.lng });
      // Optionally pre-fill description or link photo to waypoint
      // setPhotoWaypointId(waypointId);
    }
  };


  const handleUploadClick = (waypointId: string) => {
     const waypoint = waypoints.find(wp => wp.id === waypointId);
      if (waypoint && fileInputRef.current) {
        setShowPhotoUpload({ lat: waypoint.lat, lng: waypoint.lng }); // Keep upload UI open
        fileInputRef.current.click(); // Trigger file input
      }
  };


  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!showPhotoUpload || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onloadend = () => {
      const newPhoto: Photo = {
        id: `photo-${Date.now()}`,
        url: reader.result as string, // Base64 URL
        location: showPhotoUpload,
        description: photoDescription,
        // waypointId: photoWaypointId // Assign if needed
      };
      setPhotos(prev => [...prev, newPhoto]);
      toast({ title: "Photo Added", description: "Your photo has been tagged to the location." });
      handleInfoWindowClose(); // Close upload UI after success
    };

    reader.readAsDataURL(file); // Read file as Base64

     // Reset file input to allow uploading the same file again
    if (event.target) {
      event.target.value = '';
    }
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
     if (activeMarker === id) {
      setActiveMarker(null);
    }
    toast({ title: "Photo Removed", description: "The photo has been removed from the route." });
  };


  const handleSaveRoute = async () => {
    if (!routeName.trim()) {
      toast({ title: "Invalid Name", description: "Please enter a name for your route.", variant: "destructive" });
      return;
    }
    if (waypoints.length < 2) {
      toast({ title: "Not Enough Waypoints", description: "Please add at least two waypoints to save a route.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    // --- In a real app: Save to Firebase Firestore ---
    // 1. Create a new document in a 'routes' collection.
    // 2. Store routeName, waypoints (as GeoPoints or simple objects), photos (URLs, locations, descriptions).
    // 3. Consider storing the `directions` result (JSON stringified) if needed, but it might be better to recalculate on load.
    // 4. Generate a unique ID for the route.

    const routeData: RouteData = {
        id: `route-${Date.now()}`, // Placeholder ID
        name: routeName,
        waypoints,
        photos,
        directions, // Optional: store calculated directions
    };

    console.log("Saving Route:", routeData); // Simulate saving

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsSaving(false);
    toast({
      title: "Route Saved!",
      description: `Route "${routeName}" has been saved.`,
      action: (
         <Button variant="outline" size="sm" onClick={() => handleShareRoute(routeData.id)}>
            <Share2 className="mr-2 h-4 w-4" /> Share
         </Button>
      )
    });
    // --- End Simulation ---
  };

   const handleShareRoute = (routeId: string) => {
     // In a real app, use the actual saved route ID
    const shareUrl = `${window.location.origin}/view/${routeId}`; // Example URL structure
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        toast({ title: "Link Copied!", description: "Route sharing link copied to clipboard." });
      })
      .catch(err => {
        console.error('Failed to copy share link:', err);
        toast({ title: "Copy Failed", description: "Could not copy the link.", variant: "destructive" });
      });
  };

   const renderActiveMarkerInfo = () => {
    const activeWaypoint = waypoints.find(wp => wp.id === activeMarker);
    const activePhoto = photos.find(p => p.id === activeMarker);

    if (activeWaypoint) {
      return (
        <InfoWindow
          position={activeWaypoint}
          onCloseClick={handleInfoWindowClose}
          headerDisabled // Use custom header/content
          >
           <div className="p-2 min-w-48">
            <h4 className="text-md font-semibold mb-2">{activeWaypoint.name || `Waypoint ${waypoints.findIndex(wp => wp.id === activeWaypoint.id) + 1}`}</h4>
             <p className="text-xs text-muted-foreground mb-2">
                Lat: {activeWaypoint.lat.toFixed(4)}, Lng: {activeWaypoint.lng.toFixed(4)}
             </p>
            <div className="flex space-x-2 mt-2">
                 <Button size="sm" variant="outline" onClick={() => handleUploadClick(activeWaypoint.id)}>
                    <Camera className="mr-1 h-4 w-4" /> Add Photo
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Waypoint?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove this waypoint and its associated photos?
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
             {showPhotoUpload && showPhotoUpload.lat === activeWaypoint.lat && showPhotoUpload.lng === activeWaypoint.lng && (
                <div className="mt-4 border-t pt-4">
                  <h5 className="text-sm font-medium mb-2">Upload Photo</h5>
                   <Input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef} // Attach ref here
                      onChange={handlePhotoUpload}
                      className="mb-2 hidden" // Hide default input
                    />
                    {/* Custom trigger button handled by handleUploadClick */}
                  <Textarea
                    placeholder="Add a description (optional)"
                    value={photoDescription}
                    onChange={(e) => setPhotoDescription(e.target.value)}
                    className="mb-2"
                  />
                  {/* The actual upload is triggered programmatically */}
                </div>
              )}
          </div>
        </InfoWindow>
      );
    }

    if (activePhoto) {
       return (
        <InfoWindow
          position={activePhoto.location}
          onCloseClick={handleInfoWindowClose}
          headerDisabled
        >
           <div className="p-2 max-w-xs">
             {activePhoto.url && (
                <Image
                    src={activePhoto.url}
                    alt={activePhoto.description || 'Route photo'}
                    width={200}
                    height={150}
                    className="rounded-md mb-2 object-cover"
                 />
             )}
             {activePhoto.description && <p className="text-sm mb-2">{activePhoto.description}</p>}
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


  // --- Render ---
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-10rem)]"> {/* Adjust height as needed */}
      {/* Map Area */}
      <div className="md:col-span-2 h-full rounded-lg overflow-hidden shadow-md">
        <Map
          mapId={'route_snap_map'} // Optional: For cloud-based map styling
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          onClick={handleMapClick}
          className="w-full h-full"
        >
          {/* Waypoint Markers */}
          {waypoints.map((waypoint, index) => (
            <AdvancedMarker
              key={waypoint.id}
              position={waypoint}
              onClick={() => handleMarkerClick(waypoint.id)}
            >
              <Pin background={'hsl(var(--primary))'} glyphColor={'#fff'} borderColor={'#fff'}>
                {/* Display index + 1 */}
                <span className="text-xs font-bold">{index + 1}</span>
              </Pin>
            </AdvancedMarker>
          ))}

          {/* Photo Markers */}
          {photos.map((photo) => (
            <AdvancedMarker
              key={photo.id}
              position={photo.location}
              onClick={() => handleMarkerClick(photo.id)}
            >
              {/* Custom Photo Icon */}
               <div className="p-1 bg-accent rounded-full shadow cursor-pointer">
                 <Camera className="w-4 h-4 text-accent-foreground" />
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
        </CardHeader>
        <CardContent className="flex-grow flex flex-col gap-4 overflow-y-auto">
          <div className="space-y-1">
            <Label htmlFor="routeName">Route Name</Label>
            <Input
              id="routeName"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g., Scenic Coastal Drive"
            />
          </div>

           <div className="space-y-1">
             <Label htmlFor="searchLocation">Search & Add Location</Label>
             <Input
               id="searchLocation"
               ref={autocompleteInputRef}
               placeholder="Search for a place or address"
              />
           </div>

          <div className="space-y-2 flex-grow">
            <Label>Waypoints ({waypoints.length}/{MAX_WAYPOINTS})</Label>
             <p className="text-xs text-muted-foreground">Click on the map or search to add waypoints.</p>
            {waypoints.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No waypoints added yet.</p>}
            <ul className="space-y-2">
              {waypoints.map((wp, index) => (
                <li key={wp.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded-md text-sm">
                   <div className="flex items-center gap-2 overflow-hidden">
                     <span className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</span>
                     <span className="truncate" title={wp.name || `Waypoint ${index + 1}`}>{wp.name || `Waypoint ${index + 1}`}</span>
                  </div>
                   <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeWaypoint(wp.id)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove Waypoint</span>
                   </Button>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-auto flex flex-col gap-2">
             <Button onClick={handleSaveRoute} disabled={isSaving || waypoints.length < 2}>
                {isSaving ? 'Saving...' : <><Save className="mr-2 h-4 w-4" /> Save Route</>}
             </Button>
             <Button variant="outline" onClick={() => handleShareRoute(`route-${Date.now()}`)} disabled={isSaving || waypoints.length < 2}>
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
