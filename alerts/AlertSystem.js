const AnomalyDetector = require('./AnomalyDetector');
const AlertDispatcher = require('./AlertDispatcher');
const TransactionMatcher = require('./TransactionMatcher');
const WebSocketHandler = require('./WebSocketHandler');
const NotificationService = require('./NotificationService');
const { AlertOperations } = require('../db/operations');
const logger = require('../utils/logger');

class AlertSystem {
  constructor(socketIo) {
    this.socketIo = socketIo;
    this.anomalyDetector = new AnomalyDetector(this);
    this.alertDispatcher = new AlertDispatcher();
    this.transactionMatcher = new TransactionMatcher(this);
    this.webSocketHandler = new WebSocketHandler(socketIo, this);
    this.notificationService = new NotificationService();
    this.alertQueue = [];
    this.isProcessingAlerts = false;
    this.alertProcessingInterval = null;
    this.deduplicationCache = new Map();
  }

  // Initialize the alert system
  async initialize() {
    try {
      await this.alertDispatcher.initialize();

      // Initialize WebSocket handler
      this.webSocketHandler.initialize();

      // Start notification service
      this.notificationService.start();

      // Start transaction matcher
      this.transactionMatcher.start();

      // Start alert processing loop
      this.startAlertProcessing();

      // Start cleanup tasks
      this.startCleanupTasks();

      logger.info('Alert system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize alert system:', error);
      throw error;
    }
  }

  // Check transaction for anomalies
  async checkForAnomalies(transaction) {
    try {
      await this.anomalyDetector.checkTransaction(transaction);
    } catch (error) {
      logger.error('Error checking for anomalies:', error);
    }
  }

  // Send an alert
  async sendAlert(alertData) {
    try {
      // Check for duplicates
      const isDuplicate = await this.checkForDuplicateAlert(alertData);
      if (isDuplicate) {
        logger.debug('Duplicate alert suppressed:', alertData.title);
        return null;
      }

      // Create alert record
      const alert = await AlertOperations.create({
        ...alertData,
        status: 'pending',
        channels: this.getChannelsForSeverity(alertData.severity)
      });

      if (alert) {
        // Add to processing queue
        this.alertQueue.push(alert);
        
        // Emit real-time update
        this.emitRealTimeUpdate('alert', alert);
        
        logger.info(`Alert queued: ${alert.title} (${alert.severity})`);
        return alert;
      }
    } catch (error) {
      logger.error('Error sending alert:', error);
      return null;
    }
  }

  // Check for duplicate alerts
  async checkForDuplicateAlert(alertData) {
    try {
      const groupKey = this.generateGroupKey(alertData);
      const timeWindow = 60000; // 1 minute deduplication window
      
      // Check cache first
      const cacheKey = `${groupKey}_${Math.floor(Date.now() / timeWindow)}`;
      if (this.deduplicationCache.has(cacheKey)) {
        return true;
      }

      // Check database
      const existingAlerts = await AlertOperations.findByGroupKey(groupKey, timeWindow);
      if (existingAlerts.length > 0) {
        // Add to cache
        this.deduplicationCache.set(cacheKey, true);
        
        // Clean up cache periodically
        if (this.deduplicationCache.size > 1000) {
          this.cleanupDeduplicationCache();
        }
        
        return true;
      }

      // Add to cache to prevent future duplicates
      this.deduplicationCache.set(cacheKey, true);
      return false;
    } catch (error) {
      logger.error('Error checking for duplicate alert:', error);
      return false;
    }
  }

  // Generate group key for deduplication
  generateGroupKey(alertData) {
    const keyParts = [
      alertData.type,
      alertData.chainId || 'global',
      alertData.contractAddress || 'none',
      alertData.transactionId || 'none'
    ];
    return keyParts.join('_');
  }

  // Get channels based on alert severity
  getChannelsForSeverity(severity) {
    const channels = [];
    
    // Always send to dashboard
    channels.push({
      type: 'dashboard',
      target: 'dashboard'
    });

    // Add other channels based on severity
    switch (severity) {
      case 'critical':
        channels.push(
          { type: 'email', target: 'admin@bridge-monitor.com' },
          { type: 'discord', target: process.env.DISCORD_WEBHOOK_URL },
          { type: 'slack', target: process.env.SLACK_WEBHOOK_URL }
        );
        break;
      case 'high':
      case 'error':
        channels.push(
          { type: 'email', target: 'admin@bridge-monitor.com' },
          { type: 'discord', target: process.env.DISCORD_WEBHOOK_URL }
        );
        break;
      case 'warning':
      case 'medium':
        channels.push(
          { type: 'discord', target: process.env.DISCORD_WEBHOOK_URL }
        );
        break;
      case 'info':
      case 'low':
        // Only dashboard for low severity
        break;
    }

    return channels.filter(channel => channel.target && channel.target !== 'undefined');
  }

  // Start alert processing loop
  startAlertProcessing() {
    this.alertProcessingInterval = setInterval(async () => {
      if (!this.isProcessingAlerts && this.alertQueue.length > 0) {
        await this.processAlertQueue();
      }
    }, 1000); // Process every second

    logger.info('Alert processing started');
  }

  // Process the alert queue
  async processAlertQueue() {
    this.isProcessingAlerts = true;

    try {
      while (this.alertQueue.length > 0) {
        const alert = this.alertQueue.shift();
        await this.processAlert(alert);
      }
    } catch (error) {
      logger.error('Error processing alert queue:', error);
    } finally {
      this.isProcessingAlerts = false;
    }
  }

  // Process a single alert
  async processAlert(alert) {
    try {
      logger.debug(`Processing alert: ${alert.alertId}`);

      // Dispatch to all configured channels
      const dispatchPromises = alert.channels.map(async (channel) => {
        try {
          await this.alertDispatcher.dispatch(alert, channel);
          await AlertOperations.markAsSent(alert._id, channel.type);
        } catch (error) {
          logger.error(`Failed to dispatch alert to ${channel.type}:`, error);
          await AlertOperations.markAsFailed(alert._id, channel.type, error.message);
        }
      });

      await Promise.allSettled(dispatchPromises);
      
      logger.info(`Alert processed: ${alert.alertId}`);
    } catch (error) {
      logger.error(`Error processing alert ${alert.alertId}:`, error);
    }
  }

  // Emit real-time updates to connected clients
  emitRealTimeUpdate(type, data) {
    if (this.webSocketHandler) {
      this.webSocketHandler.broadcastUpdate(type, data);
    }
  }

  // Start cleanup tasks
  startCleanupTasks() {
    // Clean up old alerts every hour
    setInterval(async () => {
      try {
        await AlertOperations.deleteOldResolved(7); // Delete alerts older than 7 days
        await AlertOperations.autoResolveExpired();
        logger.debug('Alert cleanup completed');
      } catch (error) {
        logger.error('Error in alert cleanup:', error);
      }
    }, 60 * 60 * 1000); // Every hour

    // Clean up deduplication cache every 10 minutes
    setInterval(() => {
      this.cleanupDeduplicationCache();
    }, 10 * 60 * 1000);

    logger.info('Cleanup tasks started');
  }

  // Clean up deduplication cache
  cleanupDeduplicationCache() {
    const currentTime = Date.now();
    const cutoffTime = currentTime - (5 * 60 * 1000); // 5 minutes ago
    
    for (const [key, timestamp] of this.deduplicationCache.entries()) {
      if (timestamp < cutoffTime) {
        this.deduplicationCache.delete(key);
      }
    }
    
    logger.debug(`Deduplication cache cleaned up, size: ${this.deduplicationCache.size}`);
  }

  // Get system statistics
  async getStats() {
    try {
      const [alertStats, anomalyStats] = await Promise.all([
        AlertOperations.getStatusCounts(),
        this.anomalyDetector.getStats()
      ]);

      return {
        alerts: {
          queueSize: this.alertQueue.length,
          isProcessing: this.isProcessingAlerts,
          statusCounts: alertStats,
          deduplicationCacheSize: this.deduplicationCache.size
        },
        anomalies: anomalyStats
      };
    } catch (error) {
      logger.error('Error getting alert system stats:', error);
      return null;
    }
  }

  // Acknowledge an alert
  async acknowledgeAlert(alertId, acknowledgedBy, notes) {
    try {
      const alert = await AlertOperations.acknowledge(alertId, acknowledgedBy, notes);
      
      if (alert) {
        this.emitRealTimeUpdate('alert_acknowledged', {
          alertId: alert.alertId,
          acknowledgedBy,
          acknowledgedAt: alert.acknowledgedAt
        });
      }
      
      return alert;
    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  // Resolve an alert
  async resolveAlert(alertId, resolvedBy, notes) {
    try {
      const alert = await AlertOperations.resolve(alertId, resolvedBy, notes);
      
      if (alert) {
        this.emitRealTimeUpdate('alert_resolved', {
          alertId: alert.alertId,
          resolvedBy,
          resolvedAt: alert.resolvedAt
        });
      }
      
      return alert;
    } catch (error) {
      logger.error('Error resolving alert:', error);
      throw error;
    }
  }

  // Update anomaly detection rules
  updateAnomalyRules(newRules) {
    this.anomalyDetector.updateRules(newRules);
    logger.info('Anomaly detection rules updated');
  }

  // Get recent alerts for dashboard
  async getRecentAlerts(limit = 20, severity = null) {
    try {
      return await AlertOperations.getRecentAlerts(limit, severity);
    } catch (error) {
      logger.error('Error getting recent alerts:', error);
      return [];
    }
  }

  // Shutdown the alert system
  async shutdown() {
    try {
      logger.info('Shutting down alert system...');

      // Stop transaction matcher
      this.transactionMatcher.stop();

      // Stop processing
      if (this.alertProcessingInterval) {
        clearInterval(this.alertProcessingInterval);
      }

      // Process remaining alerts
      if (this.alertQueue.length > 0) {
        logger.info(`Processing ${this.alertQueue.length} remaining alerts...`);
        await this.processAlertQueue();
      }

      // Shutdown dispatcher
      await this.alertDispatcher.shutdown();

      logger.info('Alert system shutdown completed');
    } catch (error) {
      logger.error('Error during alert system shutdown:', error);
    }
  }
}

module.exports = AlertSystem;
