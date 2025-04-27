
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Route from '@/lib/models/Route'; // Adjust path as necessary
import type { RouteDocument } from '@/lib/models/Route'; // Import the type

interface Params {
  routeId: string;
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const { routeId } = params;

  if (!routeId) {
    return NextResponse.json({ message: 'Route ID is required' }, { status: 400 });
  }

  console.log(`API GET /api/routes/${routeId}: Fetching route`);

  try {
    await dbConnect();
    console.log(`API GET /api/routes/${routeId}: DB Connected`);

    const route = await Route.findOne({ id: routeId }).lean<RouteDocument>(); // Use lean() for plain JS object

    if (!route) {
      console.log(`API GET /api/routes/${routeId}: Route not found`);
      return NextResponse.json({ message: 'Route not found' }, { status: 404 });
    }

    console.log(`API GET /api/routes/${routeId}: Route found`);
    // Optionally remove the MongoDB internal _id and __v before sending
    const { _id, __v, ...routeToSend } = route;

    return NextResponse.json(routeToSend, { status: 200 });

  } catch (error: any) {
    console.error(`API GET /api/routes/${routeId}: Error fetching route:`, error);
    return NextResponse.json({ message: 'Error fetching route', error: error.message }, { status: 500 });
  }
}

// Optional: Add PUT handler for updating routes
export async function PUT(request: NextRequest, { params }: { params: Params }) {
    const { routeId } = params;
    if (!routeId) {
        return NextResponse.json({ message: 'Route ID is required' }, { status: 400 });
    }

    console.log(`API PUT /api/routes/${routeId}: Updating route`);

    try {
        await dbConnect();
        console.log(`API PUT /api/routes/${routeId}: DB Connected`);

        const body = await request.json();
        console.log(`API PUT /api/routes/${routeId}: Received body:`, body);

        // Ensure the ID in the body matches the routeId parameter for consistency
        if (body.id && body.id !== routeId) {
            return NextResponse.json({ message: 'Route ID in body does not match URL parameter' }, { status: 400 });
        }
        // Remove potentially immutable fields like _id or creatorId if they shouldn't be updated this way
        const { _id, creatorId, createdAt, ...updateData } = body;


        const updatedRoute = await Route.findOneAndUpdate(
            { id: routeId },
            { $set: updateData },
            { new: true, runValidators: true } // Return the updated document and run schema validators
        ).lean<RouteDocument>();

        if (!updatedRoute) {
            console.log(`API PUT /api/routes/${routeId}: Route not found for update`);
            return NextResponse.json({ message: 'Route not found for update' }, { status: 404 });
        }

        console.log(`API PUT /api/routes/${routeId}: Route updated successfully`);
         const { __v, ...routeToSend } = updatedRoute;
        return NextResponse.json(routeToSend, { status: 200 });

    } catch (error: any) {
        console.error(`API PUT /api/routes/${routeId}: Error updating route:`, error);
        return NextResponse.json({ message: 'Error updating route', error: error.message }, { status: 500 });
    }
}


// Optional: Add DELETE handler
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
     const { routeId } = params;
    if (!routeId) {
        return NextResponse.json({ message: 'Route ID is required' }, { status: 400 });
    }
     console.log(`API DELETE /api/routes/${routeId}: Deleting route`);
     try {
        await dbConnect();
         console.log(`API DELETE /api/routes/${routeId}: DB Connected`);

         // TODO: Before deleting the route document, you might need to delete associated photos from cloud storage.
         // Fetch the route first to get photo URLs if necessary.
         // const routeToDelete = await Route.findOne({ id: routeId });
         // if (routeToDelete && routeToDelete.photos.length > 0) {
         //    // Call function/service to delete photos from cloud storage based on routeToDelete.photos URLs
         // }

         const result = await Route.deleteOne({ id: routeId });

         if (result.deletedCount === 0) {
            console.log(`API DELETE /api/routes/${routeId}: Route not found for deletion`);
             return NextResponse.json({ message: 'Route not found' }, { status: 404 });
         }

         console.log(`API DELETE /api/routes/${routeId}: Route deleted successfully`);
         return NextResponse.json({ message: 'Route deleted successfully' }, { status: 200 }); // Or 204 No Content

     } catch (error: any) {
         console.error(`API DELETE /api/routes/${routeId}: Error deleting route:`, error);
         return NextResponse.json({ message: 'Error deleting route', error: error.message }, { status: 500 });
     }
}
