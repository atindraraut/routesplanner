
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { Coordinates } from '@/types/maps'; // Assuming Coordinates type is correctly defined

// Define interfaces matching the frontend structures but adapted for Mongoose
interface Waypoint extends Coordinates {
  id: string;
  name?: string;
  address?: string;
}

interface Photo extends Document { // Extend Document if you need Mongoose specific methods on subdocuments, otherwise just use the plain interface
  id: string;
  url: string; // Consider storing URLs from cloud storage instead of base64
  location: Coordinates;
  waypointId?: string;
  description?: string;
  locationSource: 'exif' | 'waypoint';
}

// Define the main Route Document interface extending Mongoose Document
export interface RouteDocument extends Document {
  id: string; // Use a unique ID for the route itself (could be auto-generated or custom)
  name: string;
  origin: Waypoint;
  destination: Waypoint;
  intermediateWaypoints: Waypoint[];
  photos: Photo[];
  creatorId: string; // To associate the route with a user (important for future features)
  createdAt: Date; // Automatically managed by timestamps
  updatedAt: Date; // Automatically managed by timestamps
}

// Define nested schemas for structured data (optional but good practice)
const CoordinatesSchema = new Schema<Coordinates>({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
}, { _id: false }); // Prevent Mongoose from creating _id for coordinates

const WaypointSchema = new Schema<Waypoint>({
  id: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  name: { type: String },
  address: { type: String },
}, { _id: false }); // Prevent Mongoose from creating _id for waypoints

const PhotoSchema = new Schema<Photo>({
  id: { type: String, required: true },
  url: { type: String, required: true }, // This will store the URL (e.g., from cloud storage)
  location: { type: CoordinatesSchema, required: true },
  waypointId: { type: String },
  description: { type: String },
  locationSource: { type: String, enum: ['exif', 'waypoint'], required: true },
});


// Define the main Route Schema
const routeSchema = new Schema<RouteDocument>({
  id: { // Using 'id' as the primary identifier for easier frontend integration
    type: String,
    required: true,
    unique: true,
    index: true, // Index for faster lookups
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  origin: {
    type: WaypointSchema,
    required: true,
  },
  destination: {
    type: WaypointSchema,
    required: true,
  },
  intermediateWaypoints: {
    type: [WaypointSchema], // Array of Waypoint objects
    default: [],
  },
  photos: {
    type: [PhotoSchema], // Array of Photo objects
    default: [],
  },
  creatorId: { // Link to the user who created the route
    type: String, // Or Schema.Types.ObjectId if you have a User model
    required: true,
    index: true,
  },
}, {
  timestamps: true, // Automatically add createdAt and updatedAt fields
});

// Create and export the Mongoose model
// Check if the model already exists to prevent recompilation errors in Next.js dev mode
const Route: Model<RouteDocument> = models.Route || mongoose.model<RouteDocument>('Route', routeSchema);

export default Route;

// Re-export interfaces if needed elsewhere
export type { Waypoint, Photo };
