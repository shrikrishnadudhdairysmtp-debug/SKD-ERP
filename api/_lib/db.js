import mongoose from 'mongoose';

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in serverless environments.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is missing. Please set MONGODB_URI in your Vercel Project Settings -> Environment Variables.');
  }
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('MongoDB connected successfully');
      return mongoose;
    }).catch((err) => {
      console.error('MongoDB connection error:', err);
      cached.promise = null; // Reset promise so it tries again next time
      throw err;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;
