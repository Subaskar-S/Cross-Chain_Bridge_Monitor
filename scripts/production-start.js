#!/usr/bin/env node

/**
 * Production Startup Script
 * This script initializes the Bridge Monitor in production mode
 * with proper error handling, logging, and health checks
 */

const fs = require('fs');
const path = require('path');

// Set production environment
process.env.NODE_ENV = 'production';

// Load production environment variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  console.error('❌ Production .env file not found. Please create one from .env.production.example');
  process.exit(1);
}

const logger = require('../utils/logger');

// Production validation checks
function validateProductionConfig() {
  const requiredVars = [
    'MONGODB_URI',
    'ETHEREUM_RPC_URL',
    'POLYGON_RPC_URL',
    'BSC_RPC_URL',
    'ETHEREUM_BRIDGE_CONTRACT',
    'POLYGON_BRIDGE_CONTRACT',
    'BSC_BRIDGE_CONTRACT',
    'API_KEYS',
    'JWT_SECRET'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    logger.error('❌ Missing required environment variables:', missing);
    logger.error('Please check your .env file and ensure all required variables are set');
    process.exit(1);
  }

  // Validate MongoDB URI format
  if (!process.env.MONGODB_URI.startsWith('mongodb://') && !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
    logger.error('❌ Invalid MongoDB URI format');
    process.exit(1);
  }

  // Validate contract addresses
  const contractVars = ['ETHEREUM_BRIDGE_CONTRACT', 'POLYGON_BRIDGE_CONTRACT', 'BSC_BRIDGE_CONTRACT'];
  for (const contractVar of contractVars) {
    const address = process.env[contractVar];
    if (!address.startsWith('0x') || address.length !== 42) {
      logger.error(`❌ Invalid contract address format for ${contractVar}: ${address}`);
      process.exit(1);
    }
  }

  // Validate API keys
  const apiKeys = process.env.API_KEYS.split(',');
  for (const key of apiKeys) {
    if (key.length < 32) {
      logger.error('❌ API keys must be at least 32 characters long');
      process.exit(1);
    }
  }

  // Validate JWT secret
  if (process.env.JWT_SECRET.length < 32) {
    logger.error('❌ JWT_SECRET must be at least 32 characters long');
    process.exit(1);
  }

  logger.info('✅ Production configuration validation passed');
}

// Check system requirements
function checkSystemRequirements() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 16) {
    logger.error(`❌ Node.js version ${nodeVersion} is not supported. Please use Node.js 16 or higher`);
    process.exit(1);
  }

  // Check available memory
  const totalMemory = require('os').totalmem();
  const totalMemoryGB = totalMemory / (1024 * 1024 * 1024);
  
  if (totalMemoryGB < 2) {
    logger.warn(`⚠️  Low memory detected: ${totalMemoryGB.toFixed(1)}GB. Recommended: 4GB+`);
  }

  logger.info(`✅ System requirements check passed (Node.js ${nodeVersion}, ${totalMemoryGB.toFixed(1)}GB RAM)`);
}

// Initialize production logging
function initializeLogging() {
  const logDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  logger.info('✅ Logging initialized');
}

// Health check function
async function performHealthCheck() {
  try {
    // Check database connection
    const { connectDB, isConnected } = require('../db/connection');
    if (!isConnected()) {
      await connectDB();
    }
    
    logger.info('✅ Database connection healthy');
    
    // Check RPC endpoints
    const Web3 = require('web3');
    const rpcEndpoints = [
      { name: 'Ethereum', url: process.env.ETHEREUM_RPC_URL },
      { name: 'Polygon', url: process.env.POLYGON_RPC_URL },
      { name: 'BSC', url: process.env.BSC_RPC_URL }
    ];
    
    for (const endpoint of rpcEndpoints) {
      try {
        const web3 = new Web3(endpoint.url);
        await web3.eth.getBlockNumber();
        logger.info(`✅ ${endpoint.name} RPC connection healthy`);
      } catch (error) {
        logger.error(`❌ ${endpoint.name} RPC connection failed:`, error.message);
        throw error;
      }
    }
    
    logger.info('✅ All health checks passed');
    return true;
  } catch (error) {
    logger.error('❌ Health check failed:', error);
    return false;
  }
}

// Graceful shutdown handler
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    logger.info(`🛑 Received ${signal}, starting graceful shutdown...`);
    
    try {
      // Stop accepting new connections
      if (global.server) {
        global.server.close(() => {
          logger.info('✅ HTTP server closed');
        });
      }
      
      // Close database connections
      const { disconnectDB } = require('../db/connection');
      await disconnectDB();
      logger.info('✅ Database connections closed');
      
      // Close any other resources
      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
}

// Main startup function
async function startProduction() {
  try {
    logger.info('🚀 Starting Bridge Monitor in Production Mode...');
    
    // Run all validation checks
    validateProductionConfig();
    checkSystemRequirements();
    initializeLogging();
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    // Perform health checks
    const healthCheckPassed = await performHealthCheck();
    if (!healthCheckPassed) {
      logger.error('❌ Health checks failed, aborting startup');
      process.exit(1);
    }
    
    // Start the main application
    logger.info('🌐 Starting main application...');
    
    // Use the production server (not test-server)
    if (fs.existsSync(path.join(__dirname, '..', 'index.js'))) {
      require('../index.js');
    } else {
      // Fallback to test server for demo
      logger.warn('⚠️  Main server not found, using test server');
      require('../test-server.js');
    }
    
    logger.info('✅ Bridge Monitor started successfully in production mode');
    
    // Log startup summary
    logger.info('📊 Production Configuration Summary:');
    logger.info(`   - Environment: ${process.env.NODE_ENV}`);
    logger.info(`   - Port: ${process.env.PORT || 3000}`);
    logger.info(`   - Database: ${process.env.MONGODB_URI.split('@')[1] || 'MongoDB'}`);
    logger.info(`   - Alerts: ${process.env.ENABLE_ALERTS === 'true' ? 'Enabled' : 'Disabled'}`);
    logger.info(`   - Listeners: ${process.env.ENABLE_LISTENERS === 'true' ? 'Enabled' : 'Disabled'}`);
    logger.info(`   - WebSockets: ${process.env.ENABLE_WEBSOCKETS !== 'false' ? 'Enabled' : 'Disabled'}`);
    
  } catch (error) {
    logger.error('❌ Failed to start production server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
if (require.main === module) {
  startProduction();
}

module.exports = { startProduction, validateProductionConfig, performHealthCheck };
