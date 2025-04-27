
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env or .env.local'
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    console.log('Using cached MongoDB connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable buffering to catch errors earlier
      // useNewUrlParser: true, // Deprecated but sometimes needed for older setups
      // useUnifiedTopology: true, // Deprecated but sometimes needed
    };

    console.log('Creating new MongoDB connection promise');
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
        console.log('MongoDB connected successfully');
        return mongooseInstance;
    }).catch(error => {
        console.error('MongoDB connection error:', error);
        cached.promise = null; // Reset promise on error
        throw error; // Re-throw error to indicate connection failure
    });
  }

  try {
    console.log('Awaiting MongoDB connection promise');
    cached.conn = await cached.promise;
    console.log('MongoDB connection established');
    return cached.conn;
  } catch (error) {
     console.error('Failed to establish MongoDB connection:', error);
     cached.promise = null; // Ensure promise is reset if await fails
     throw error; // Propagate error
  }

}

export default dbConnect;
