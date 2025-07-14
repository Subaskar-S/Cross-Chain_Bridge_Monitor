require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import configuration
const config = require('./config/default');

// Import database connection
const connectDB = require('./db/connection');

// Import logger
const logger = require('./utils/logger');

// Import API routes
const apiRoutes = require('./api');

// Import event listeners
const EventListenerManager = require('./listeners/EventListenerManager');

// Import alert system
const AlertSystem = require('./alerts/AlertSystem');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dashboard/build')));

// API Routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve static files from dashboard build (if built)
if (fs.existsSync(path.join(__dirname, 'dashboard/build'))) {
  app.use(express.static(path.join(__dirname, 'dashboard/build')));

  // Serve React app for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard/build', 'index.html'));
  });
} else {
  // Development message if dashboard is not built
  app.get('*', (req, res) => {
    res.json({
      message: 'Dashboard not built. Run "cd dashboard && npm run build" to build the React dashboard.',
      api: {
        base: '/api',
        health: '/api/health',
        docs: '/api/docs'
      }
    });
  });
}

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize systems
async function initializeApp() {
  try {
    // Connect to database
    await connectDB();
    logger.info('Database connected successfully');

    // Initialize alert system
    const alertSystem = new AlertSystem(io);
    await alertSystem.initialize();
    logger.info('Alert system initialized');

    // Initialize event listeners
    const eventListenerManager = new EventListenerManager(alertSystem, io);
    await eventListenerManager.initialize();
    logger.info('Event listeners initialized');

    // Start server
    const PORT = config.server.port;
    server.listen(PORT, () => {
      logger.info(`Bridge monitoring system started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Socket.io connection handling
    io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);
      
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });

  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start the application
initializeApp();
