const logger = require('../utils/logger');
const config = require('../config/default');

class NotificationService {
  constructor() {
    this.notificationQueue = [];
    this.isProcessing = false;
    this.processingInterval = null;
    this.rateLimits = new Map();
    this.templates = new Map();
    
    this.initializeTemplates();
  }

  // Initialize notification templates
  initializeTemplates() {
    // Email templates
    this.templates.set('email_critical', {
      subject: '🚨 CRITICAL: {title}',
      html: `
        <div style="background-color: #dc3545; color: white; padding: 20px; border-radius: 8px;">
          <h1>🚨 CRITICAL ALERT</h1>
          <h2>{title}</h2>
          <p>{message}</p>
          <div style="background-color: rgba(255,255,255,0.1); padding: 15px; border-radius: 4px; margin-top: 20px;">
            <strong>Network:</strong> {networkName}<br>
            <strong>Time:</strong> {timestamp}<br>
            <strong>Transaction:</strong> {transactionHash}
          </div>
        </div>
      `
    });

    // Discord templates
    this.templates.set('discord_anomaly', {
      embeds: [{
        title: '⚠️ Anomaly Detected',
        description: '{message}',
        color: 0xff6b35,
        fields: [
          { name: 'Type', value: '{anomalyType}', inline: true },
          { name: 'Network', value: '{networkName}', inline: true },
          { name: 'Severity', value: '{severity}', inline: true }
        ],
        timestamp: '{timestamp}'
      }]
    });

    // Slack templates
    this.templates.set('slack_bridge_timeout', {
      text: '🕐 Bridge Transaction Timeout',
      attachments: [{
        color: 'warning',
        fields: [
          { title: 'Transaction', value: '{transactionHash}', short: false },
          { title: 'Network', value: '{networkName}', short: true },
          { title: 'Amount', value: '{amount} {token}', short: true }
        ]
      }]
    });

    logger.info(`Notification templates initialized: ${this.templates.size} templates`);
  }

  // Start the notification service
  start() {
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing && this.notificationQueue.length > 0) {
        await this.processQueue();
      }
    }, 1000);

    logger.info('Notification service started');
  }

  // Stop the notification service
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    logger.info('Notification service stopped');
  }

  // Queue a notification
  queueNotification(notification) {
    // Check rate limits
    if (this.isRateLimited(notification)) {
      logger.debug(`Notification rate limited: ${notification.type}`);
      return false;
    }

    this.notificationQueue.push({
      ...notification,
      queuedAt: new Date(),
      attempts: 0
    });

    logger.debug(`Notification queued: ${notification.type} to ${notification.channel}`);
    return true;
  }

  // Check if notification is rate limited
  isRateLimited(notification) {
    const key = `${notification.channel}_${notification.type}`;
    const now = Date.now();
    const limit = this.getRateLimit(notification.channel, notification.severity);
    
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, []);
    }

    const timestamps = this.rateLimits.get(key);
    
    // Remove old timestamps
    const cutoff = now - limit.window;
    const recentTimestamps = timestamps.filter(ts => ts > cutoff);
    
    // Check if limit exceeded
    if (recentTimestamps.length >= limit.count) {
      return true;
    }

    // Add current timestamp
    recentTimestamps.push(now);
    this.rateLimits.set(key, recentTimestamps);
    
    return false;
  }

  // Get rate limit for channel and severity
  getRateLimit(channel, severity) {
    const limits = {
      email: {
        critical: { count: 10, window: 60000 }, // 10 per minute
        high: { count: 5, window: 60000 },      // 5 per minute
        medium: { count: 3, window: 60000 },    // 3 per minute
        low: { count: 1, window: 60000 }        // 1 per minute
      },
      discord: {
        critical: { count: 20, window: 60000 }, // 20 per minute
        high: { count: 15, window: 60000 },     // 15 per minute
        medium: { count: 10, window: 60000 },   // 10 per minute
        low: { count: 5, window: 60000 }        // 5 per minute
      },
      slack: {
        critical: { count: 15, window: 60000 }, // 15 per minute
        high: { count: 10, window: 60000 },     // 10 per minute
        medium: { count: 8, window: 60000 },    // 8 per minute
        low: { count: 3, window: 60000 }        // 3 per minute
      }
    };

    return limits[channel]?.[severity] || { count: 5, window: 60000 };
  }

  // Process notification queue
  async processQueue() {
    this.isProcessing = true;

    try {
      while (this.notificationQueue.length > 0) {
        const notification = this.notificationQueue.shift();
        await this.processNotification(notification);
      }
    } catch (error) {
      logger.error('Error processing notification queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process a single notification
  async processNotification(notification) {
    try {
      notification.attempts++;
      
      // Apply template if available
      const processedNotification = this.applyTemplate(notification);
      
      // Send notification based on channel
      switch (notification.channel) {
        case 'email':
          await this.sendEmailNotification(processedNotification);
          break;
        case 'discord':
          await this.sendDiscordNotification(processedNotification);
          break;
        case 'slack':
          await this.sendSlackNotification(processedNotification);
          break;
        case 'webhook':
          await this.sendWebhookNotification(processedNotification);
          break;
        default:
          throw new Error(`Unknown notification channel: ${notification.channel}`);
      }

      logger.info(`Notification sent: ${notification.type} via ${notification.channel}`);
    } catch (error) {
      logger.error(`Failed to send notification (attempt ${notification.attempts}):`, error);
      
      // Retry logic
      if (notification.attempts < 3) {
        // Re-queue with delay
        setTimeout(() => {
          this.notificationQueue.push(notification);
        }, notification.attempts * 2000); // Exponential backoff
      }
    }
  }

  // Apply template to notification
  applyTemplate(notification) {
    const templateKey = `${notification.channel}_${notification.type}`;
    const template = this.templates.get(templateKey);
    
    if (!template) {
      return notification;
    }

    // Replace placeholders in template
    const processedTemplate = this.replacePlaceholders(template, notification.data);
    
    return {
      ...notification,
      template: processedTemplate
    };
  }

  // Replace placeholders in template
  replacePlaceholders(template, data) {
    const templateStr = JSON.stringify(template);
    const processedStr = templateStr.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] || match;
    });
    
    return JSON.parse(processedStr);
  }

  // Send email notification
  async sendEmailNotification(notification) {
    // This would integrate with the AlertDispatcher's email functionality
    logger.debug('Email notification would be sent here');
  }

  // Send Discord notification
  async sendDiscordNotification(notification) {
    // This would integrate with the AlertDispatcher's Discord functionality
    logger.debug('Discord notification would be sent here');
  }

  // Send Slack notification
  async sendSlackNotification(notification) {
    // This would integrate with the AlertDispatcher's Slack functionality
    logger.debug('Slack notification would be sent here');
  }

  // Send webhook notification
  async sendWebhookNotification(notification) {
    // This would integrate with the AlertDispatcher's webhook functionality
    logger.debug('Webhook notification would be sent here');
  }

  // Create notification for bridge timeout
  createBridgeTimeoutNotification(transaction, channels) {
    return channels.map(channel => ({
      type: 'bridge_timeout',
      channel: channel.type,
      target: channel.target,
      severity: 'high',
      data: {
        title: 'Bridge Transaction Timeout',
        message: `Transaction ${transaction.txHash} has timed out`,
        transactionHash: transaction.txHash,
        networkName: transaction.networkName,
        amount: transaction.amountFormatted,
        token: transaction.tokenSymbol,
        timestamp: new Date().toISOString()
      }
    }));
  }

  // Create notification for anomaly detection
  createAnomalyNotification(anomaly, channels) {
    return channels.map(channel => ({
      type: 'anomaly',
      channel: channel.type,
      target: channel.target,
      severity: anomaly.severity,
      data: {
        title: anomaly.title,
        message: anomaly.description,
        anomalyType: anomaly.type,
        networkName: anomaly.networkName,
        severity: anomaly.severity,
        timestamp: new Date(anomaly.detectedAt).toISOString()
      }
    }));
  }

  // Create notification for high volume transaction
  createHighVolumeNotification(transaction, channels) {
    return channels.map(channel => ({
      type: 'high_volume',
      channel: channel.type,
      target: channel.target,
      severity: 'warning',
      data: {
        title: 'High Volume Transaction',
        message: `Large transaction detected: ${transaction.amountFormatted} ${transaction.tokenSymbol}`,
        transactionHash: transaction.txHash,
        networkName: transaction.networkName,
        amount: transaction.amountFormatted,
        token: transaction.tokenSymbol,
        timestamp: new Date(transaction.timestamp).toISOString()
      }
    }));
  }

  // Get notification statistics
  getStats() {
    return {
      queueSize: this.notificationQueue.length,
      isProcessing: this.isProcessing,
      rateLimitEntries: this.rateLimits.size,
      templates: this.templates.size
    };
  }

  // Clear rate limits (for testing or manual reset)
  clearRateLimits() {
    this.rateLimits.clear();
    logger.info('Rate limits cleared');
  }

  // Add custom template
  addTemplate(key, template) {
    this.templates.set(key, template);
    logger.info(`Template added: ${key}`);
  }

  // Remove template
  removeTemplate(key) {
    const removed = this.templates.delete(key);
    if (removed) {
      logger.info(`Template removed: ${key}`);
    }
    return removed;
  }
}

module.exports = NotificationService;
