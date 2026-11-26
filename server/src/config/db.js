const mongoose = require('mongoose');

let mongoMemoryServer = null;

const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    let mongoUri = process.env.MONGO_URI;

    if (!mongoUri || mongoUri.trim() === '') {
      if (isProduction) {
        throw new Error('MONGO_URI must be configured in production');
      }
      console.log('⚡ MONGO_URI not configured. Starting in-memory MongoDB server for development/testing...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoMemoryServer = await MongoMemoryServer.create();
      mongoUri = mongoMemoryServer.getUri();
      console.log(`⚡ In-memory MongoDB running at: ${mongoUri}`);
    }

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Never fall back to ephemeral in-memory storage in production
    if (isProduction) {
      process.exit(1);
    }
    // If external mongo failed in dev/test, try in-memory fallback
    if (!mongoMemoryServer) {
      try {
        console.log('🔄 Falling back to in-memory MongoDB...');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongoMemoryServer = await MongoMemoryServer.create();
        const mongoUri = mongoMemoryServer.getUri();
        const conn = await mongoose.connect(mongoUri);
        console.log(`✅ Connected to in-memory fallback MongoDB at ${mongoUri}`);
        return conn;
      } catch (fallbackError) {
        console.error('❌ Failed to start fallback MongoDB:', fallbackError.message);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
};

module.exports = { connectDB, disconnectDB };
