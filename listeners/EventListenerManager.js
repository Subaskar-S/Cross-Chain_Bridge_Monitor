const BaseEventListener = require('./BaseEventListener');
const EthereumListener = require('./EthereumListener');
const PolygonListener = require('./PolygonListener');
const BSCListener = require('./BSCListener');
const config = require('../config/default');
const logger = require('../utils/logger');

class EventListenerManager {
  constructor(alertSystem, socketIo) {
    this.alertSystem = alertSystem;
    this.socketIo = socketIo;
    this.listeners = new Map();
    this.isRunning = false;
    this.healthCheckInterval = null;
  }

  // Initialize all network listeners
  async initialize() {
    try {
      logger.info('Initializing Event Listener Manager...');

      // Initialize listeners for each configured network
      for (const [networkName, networkConfig] of Object.entries(config.networks)) {
        if (this.isNetworkEnabled(networkConfig)) {
          await this.initializeNetworkListener(networkName, networkConfig);
        } else {
          logger.warn(`Network ${networkName} is disabled or misconfigured`);
        }
      }

      // Start health monitoring
      this.startHealthMonitoring();

      this.isRunning = true;
      logger.info(`Event Listener Manager initialized with ${this.listeners.size} networks`);
    } catch (error) {
      logger.error('Failed to initialize Event Listener Manager:', error);
      throw error;
    }
  }

  // Check if network is properly configured and enabled
  isNetworkEnabled(networkConfig) {
    return networkConfig.rpcUrl && 
           networkConfig.wsUrl && 
           networkConfig.bridgeContract && 
           networkConfig.bridgeContract !== '0x...';
  }

  // Initialize listener for a specific network
  async initializeNetworkListener(networkName, networkConfig) {
    try {
      logger.info(`Initializing ${networkName} listener...`);

      // Create network-specific listener
      let listener;
      switch (networkName.toLowerCase()) {
        case 'ethereum':
          listener = new EthereumListener(networkConfig, this.alertSystem);
          break;
        case 'polygon':
          listener = new PolygonListener(networkConfig, this.alertSystem);
          break;
        case 'bsc':
          listener = new BSCListener(networkConfig, this.alertSystem);
          break;
        default:
          // Fallback to base listener for unknown networks
          listener = new BaseEventListener(networkConfig, this.alertSystem);
          logger.warn(`Using base listener for unknown network: ${networkName}`);
      }

      await listener.initialize();

      this.listeners.set(networkName, listener);
      logger.info(`${networkName} listener initialized successfully`);
    } catch (error) {
      logger.error(`Failed to initialize ${networkName} listener:`, error);

      // Send alert about failed initialization
      await this.alertSystem.sendAlert({
        type: 'system_error',
        severity: 'error',
        title: `${networkName} Listener Initialization Failed`,
        message: `Failed to initialize event listener for ${networkName}: ${error.message}`,
        chainId: networkConfig.chainId,
        networkName: networkName
      });
    }
  }

  // Start listening on all networks
  async startListening() {
    try {
      logger.info('Starting event listeners for all networks...');

      const startPromises = Array.from(this.listeners.entries()).map(async ([networkName, listener]) => {
        try {
          await listener.startListening();
          logger.info(`${networkName} listener started successfully`);
        } catch (error) {
          logger.error(`Failed to start ${networkName} listener:`, error);
          
          await this.alertSystem.sendAlert({
            type: 'system_error',
            severity: 'error',
            title: `${networkName} Listener Start Failed`,
            message: `Failed to start event listener for ${networkName}: ${error.message}`,
            chainId: listener.networkConfig.chainId,
            networkName: networkName
          });
        }
      });

      await Promise.allSettled(startPromises);
      
      const activeListeners = Array.from(this.listeners.values()).filter(l => l.isListening).length;
      logger.info(`Event listening started on ${activeListeners}/${this.listeners.size} networks`);

      // Emit status update
      this.emitStatusUpdate();
    } catch (error) {
      logger.error('Error starting event listeners:', error);
      throw error;
    }
  }

  // Stop listening on all networks
  async stopListening() {
    try {
      logger.info('Stopping event listeners for all networks...');

      const stopPromises = Array.from(this.listeners.values()).map(listener => 
        listener.stopListening()
      );

      await Promise.allSettled(stopPromises);
      
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      this.isRunning = false;
      logger.info('All event listeners stopped');
    } catch (error) {
      logger.error('Error stopping event listeners:', error);
    }
  }

  // Restart a specific network listener
  async restartNetworkListener(networkName) {
    try {
      logger.info(`Restarting ${networkName} listener...`);

      const listener = this.listeners.get(networkName);
      if (!listener) {
        throw new Error(`Listener for ${networkName} not found`);
      }

      // Stop the current listener
      await listener.stopListening();

      // Reinitialize and start
      await listener.initialize();
      await listener.startListening();

      logger.info(`${networkName} listener restarted successfully`);
      this.emitStatusUpdate();
    } catch (error) {
      logger.error(`Failed to restart ${networkName} listener:`, error);
      throw error;
    }
  }

  // Get status of all listeners
  getStatus() {
    const status = {
      isRunning: this.isRunning,
      totalNetworks: this.listeners.size,
      activeListeners: 0,
      networks: {}
    };

    for (const [networkName, listener] of this.listeners) {
      const listenerStatus = listener.getStatus();
      status.networks[networkName] = listenerStatus;
      
      if (listenerStatus.isListening) {
        status.activeListeners++;
      }
    }

    return status;
  }

  // Start health monitoring
  startHealthMonitoring() {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000);

    logger.info('Health monitoring started');
  }

  // Perform health check on all listeners
  async performHealthCheck() {
    try {
      const status = this.getStatus();
      
      // Check for inactive listeners
      for (const [networkName, networkStatus] of Object.entries(status.networks)) {
        if (!networkStatus.isListening) {
          logger.warn(`${networkName} listener is not active`);
          
          // Attempt to restart inactive listener
          try {
            await this.restartNetworkListener(networkName);
          } catch (error) {
            logger.error(`Failed to restart ${networkName} listener during health check:`, error);
            
            await this.alertSystem.sendAlert({
              type: 'system_error',
              severity: 'warning',
              title: `${networkName} Listener Health Check Failed`,
              message: `Listener for ${networkName} is inactive and restart failed: ${error.message}`,
              chainId: networkStatus.chainId,
              networkName: networkName
            });
          }
        }
      }

      // Emit status update to dashboard
      this.emitStatusUpdate();

      // Log health summary
      logger.debug(`Health check completed: ${status.activeListeners}/${status.totalNetworks} listeners active`);
    } catch (error) {
      logger.error('Error during health check:', error);
    }
  }

  // Emit status update to connected clients
  emitStatusUpdate() {
    if (this.socketIo) {
      const status = this.getStatus();
      this.socketIo.emit('listener_status', status);
    }
  }

  // Get listener for specific network
  getListener(networkName) {
    return this.listeners.get(networkName);
  }

  // Add new network listener dynamically
  async addNetworkListener(networkName, networkConfig) {
    try {
      if (this.listeners.has(networkName)) {
        throw new Error(`Listener for ${networkName} already exists`);
      }

      await this.initializeNetworkListener(networkName, networkConfig);
      
      if (this.isRunning) {
        const listener = this.listeners.get(networkName);
        await listener.startListening();
      }

      logger.info(`${networkName} listener added successfully`);
      this.emitStatusUpdate();
    } catch (error) {
      logger.error(`Failed to add ${networkName} listener:`, error);
      throw error;
    }
  }

  // Remove network listener
  async removeNetworkListener(networkName) {
    try {
      const listener = this.listeners.get(networkName);
      if (!listener) {
        throw new Error(`Listener for ${networkName} not found`);
      }

      await listener.stopListening();
      this.listeners.delete(networkName);

      logger.info(`${networkName} listener removed successfully`);
      this.emitStatusUpdate();
    } catch (error) {
      logger.error(`Failed to remove ${networkName} listener:`, error);
      throw error;
    }
  }

  // Get network statistics
  async getNetworkStatistics() {
    const stats = {};

    for (const [networkName, listener] of this.listeners) {
      const status = listener.getStatus();
      
      stats[networkName] = {
        chainId: status.chainId,
        isActive: status.isListening,
        lastProcessedBlock: status.lastProcessedBlock,
        reconnectAttempts: status.reconnectAttempts,
        activeSubscriptions: status.activeSubscriptions.length
      };
    }

    return stats;
  }

  // Handle graceful shutdown
  async shutdown() {
    try {
      logger.info('Shutting down Event Listener Manager...');
      
      await this.stopListening();
      this.listeners.clear();
      
      logger.info('Event Listener Manager shutdown completed');
    } catch (error) {
      logger.error('Error during Event Listener Manager shutdown:', error);
    }
  }
}

module.exports = EventListenerManager;
