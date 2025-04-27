
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Route from '@/lib/models/Route';
import type { Photo } from '@/lib/models/Route'; // Import Photo type if needed separately

// --- Mock Cloud Storage Upload ---
// In a real application, replace this with your actual cloud storage logic (e.g., Firebase Storage, AWS S3)
async function uploadToCloudStorage(base64Data: string, fileName: string): Promise<string> {
    console.log(`Mock uploading ${fileName} to cloud storage...`);
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // In a real scenario:
    // 1. Decode base64 string to a buffer.
    // const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
    // const mimeType = base64Data.match(/data:(.*);base64,/)?.[1] || 'image/jpeg';
    // 2. Use the cloud storage SDK (e.g., @google-cloud/storage, aws-sdk) to upload the buffer.
    //    Ensure you set the correct content type (mimeType).
    // 3. Get the public URL of the uploaded file.
    // Example (pseudo-code for Firebase Storage):
    // const storageRef = ref(storage, `route_photos/${Date.now()}_${fileName}`);
    // const snapshot = await uploadString(storageRef, base64Data, 'data_url');
    // const downloadURL = await getDownloadURL(snapshot.ref);
    // return downloadURL;

    // For this mock, we'll just return a placeholder URL
    // Using picsum.photos for variety, replace with a static placeholder if preferred
    const randomId = Math.floor(Math.random() * 1000);
    const mockUrl = `https://picsum.photos/seed/${randomId}/400/300`;
    console.log(`Mock upload complete. URL: ${mockUrl}`);
    return mockUrl;
}
// --- End Mock Cloud Storage Upload ---


export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        console.log("API POST /api/photos/upload: DB Connected");

        const body = await request.json();
        const { routeId, photoDataUrl, location, description, waypointId, locationSource } = body;

        // Basic validation
        if (!routeId || !photoDataUrl || !location || !locationSource) {
             console.error("API POST /api/photos/upload: Validation failed - Missing required fields");
            return NextResponse.json({ message: 'Missing required fields (routeId, photoDataUrl, location, locationSource)' }, { status: 400 });
        }

        // 1. Upload photo to cloud storage (using mock function here)
        const photoId = `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`; // Generate unique ID
        const fileName = `${routeId}_${photoId}.jpg`; // Example filename structure
        const photoUrl = await uploadToCloudStorage(photoDataUrl, fileName); // Get URL from storage

        if (!photoUrl) {
            throw new Error("Failed to upload photo to storage.");
        }

        // 2. Prepare photo metadata object
        const newPhoto: Photo = {
            id: photoId,
            url: photoUrl,
            location: location, // Assuming location is { lat: number, lng: number }
            description: description || '',
            waypointId: waypointId, // Will be undefined if not provided
            locationSource: locationSource,
        } as Photo; // Cast necessary if Photo extends Document

         // 3. Add photo metadata to the specific Route document in MongoDB
         console.log(`API POST /api/photos/upload: Adding photo ${photoId} to route ${routeId}`);
         const updateResult = await Route.updateOne(
             { id: routeId }, // Find the route by its ID
             { $push: { photos: newPhoto } } // Add the new photo object to the 'photos' array
         );

         console.log("API POST /api/photos/upload: MongoDB updateOne result:", updateResult);

         if (updateResult.matchedCount === 0) {
             console.log(`API POST /api/photos/upload: Route ${routeId} not found for adding photo.`);
             // Consider if you should delete the uploaded photo from storage here
             return NextResponse.json({ message: `Route with ID ${routeId} not found.` }, { status: 404 });
         }
         if (updateResult.modifiedCount === 0) {
             // This might happen if the update operation didn't change the document (e.g., error, or race condition)
             console.warn(`API POST /api/photos/upload: Route ${routeId} found but photo was not added.`);
             // Consider potential issues or if this is an acceptable state
             // Might still return success but log a warning
             // For now, treat as potential error
             return NextResponse.json({ message: 'Route found, but photo could not be added to the database.' }, { status: 500 });
         }

        console.log(`API POST /api/photos/upload: Photo ${photoId} added to route ${routeId} successfully.`);
        // Return the ID and URL of the newly added photo
        return NextResponse.json({ message: 'Photo uploaded and added to route successfully', photoId: newPhoto.id, photoUrl: newPhoto.url }, { status: 201 }); // 201 Created

    } catch (error: any) {
        console.error('API POST /api/photos/upload: Error:', error);
        return NextResponse.json({ message: 'Error uploading photo', error: error.message }, { status: 500 });
    }
}
