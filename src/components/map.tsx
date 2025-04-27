'use client';

import { useEffect } from 'react';

const Map = ({ apiKey }) => {
  useEffect(() => {
    if (!apiKey) {
      console.error('API key not provided.');
      return;
    }

    // Check if the script already exists
    if (document.getElementById('google-maps-script')) {
      console.log("Google Maps script already loaded.");
      // Ensure map initialization happens if the script is already loaded
      // You might need a more robust way to ensure the map div is ready
      // and the google.maps object is available.
      // For now, we assume if the script exists, the API loaded or will load.
      return;
    }


    const script = document.createElement('script');
    script.id = 'google-maps-script'; // Add an ID to check for existence
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`; // Use async loading
    script.async = true;
    // defer is generally not needed with async
    // script.defer = true;
    script.onload = () => {
      console.log("Google Maps script loaded successfully.");
      // Initialize map or relevant logic here if needed immediately after script load
      // Be mindful that the Map component in route-planner might handle initialization
    };
    script.onerror = () => console.error("Error loading Google Maps script");
    document.head.appendChild(script);

    // Cleanup function to remove the script if the component unmounts
    // This might not be strictly necessary if the script is meant to be global once loaded,
    // but it's good practice for component-specific resources.
    // However, removing it might break other map instances if they rely on the same script load.
    // Consider the application structure: if maps are used globally/persistently, don't remove.
    // If this Map component is the *only* place it's loaded, cleanup might be okay.
    // For simplicity and given the context, we'll comment out the removal.
    // return () => {
    //   const existingScript = document.getElementById('google-maps-script');
    //   if (existingScript) {
    //     document.head.removeChild(existingScript);
    //   }
    // };
  }, [apiKey]); // Dependency array ensures this runs only when apiKey changes

  // The Map component now primarily focuses on loading the script.
  // The actual map rendering is handled by @vis.gl/react-google-maps components elsewhere.
  // This div could serve as a fallback or placeholder, but isn't strictly needed for script loading.
  // return <div id="map-loader-placeholder" className="hidden"></div>;
  // Returning null as this component's main job is the side effect of loading the script.
    return null;
};

export default Map;
