const mongoose = require('mongoose');
const config = require('../config/default');
const logger = require('../utils/logger');

// Connection options
const options = {
  ...config.database.mongodb.options,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
  bufferMaxEntries: 0
};

// Connection state tracking
let isConnected = false;

// Connect to MongoDB
const connectDB = async () => {
  try {
    if (isConnected) {
      logger.info('Database already connected');
      return;
    }

    const conn = await mongoose.connect(config.database.mongodb.uri, options);
    
    isConnected = true;
    logger.info(`MongoDB connected: ${conn.connection.host}`);
    
    // Connection event handlers
    mongoose.connection.on('connected', () => {
      isConnected = true;
      logger.info('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      isConnected = false;
      logger.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      logger.warn('Mongoose disconnected from MongoDB');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('Mongoose connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    isConnected = false;
    logger.error('Database connection failed:', error);
    throw error;
  }
};

// Get connection status
const getConnectionStatus = () => {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name
  };
};

// Disconnect from database
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
    throw error;
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  getConnectionStatus
};
