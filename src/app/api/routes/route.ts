
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Route from '@/lib/models/Route';
import type { RouteDocument } from '@/lib/models/Route'; // Import the type

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    console.log("API POST /api/routes: DB Connected");

    const body = await request.json();
    console.log("API POST /api/routes: Received body:", body);

    // Basic validation
    if (!body.id || !body.name || !body.origin || !body.destination || !body.creatorId) {
      console.error("API POST /api/routes: Validation failed - Missing required fields");
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Use updateOne with upsert: true to either update or insert the route
    // This prevents duplicate routes if the save button is clicked multiple times quickly
    // with the same client-generated ID before the first save completes.
    const result = await Route.updateOne(
      { id: body.id }, // Filter by the unique route ID
      { $set: body },   // Data to set (the entire route object)
      { upsert: true }  // Create if doesn't exist, update if it does
    );

    console.log("API POST /api/routes: MongoDB updateOne result:", result);

    if (result.upsertedCount > 0 || result.modifiedCount > 0 || result.matchedCount > 0) {
       console.log(`API POST /api/routes: Route ${result.upsertedCount > 0 ? 'created' : 'updated'} successfully with ID: ${body.id}`);
      // Return the ID of the created/updated route
      return NextResponse.json({ message: 'Route saved successfully', id: body.id }, { status: result.upsertedCount > 0 ? 201 : 200 });
    } else {
       // This case should ideally not happen with upsert: true unless there's a DB issue
       console.error(`API POST /api/routes: Failed to save or update route ${body.id}. Result:`, result);
       return NextResponse.json({ message: 'Failed to save route, unexpected database result.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API POST /api/routes: Error saving route:', error);
     // Check for duplicate key error (if unique index is violated, though upsert should handle this)
     if (error.code === 11000) {
         return NextResponse.json({ message: `Route with ID ${error.keyValue?.id || 'provided'} already exists. Use PUT to update.` }, { status: 409 }); // Conflict
     }
    return NextResponse.json({ message: 'Error saving route', error: error.message }, { status: 500 });
  }
}

// Optional: Add GET handler to list routes (useful for debugging or future features)
export async function GET(request: NextRequest) {
     try {
         await dbConnect();
         console.log("API GET /api/routes: DB Connected");

         // Example: Fetch all routes (consider pagination for large datasets)
         const routes = await Route.find({}).limit(50); // Limit for safety

         console.log(`API GET /api/routes: Found ${routes.length} routes.`);
         return NextResponse.json(routes, { status: 200 });

     } catch (error: any) {
         console.error('API GET /api/routes: Error fetching routes:', error);
         return NextResponse.json({ message: 'Error fetching routes', error: error.message }, { status: 500 });
     }
}
