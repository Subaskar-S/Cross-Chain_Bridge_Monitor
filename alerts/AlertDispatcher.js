const nodemailer = require('nodemailer');
const axios = require('axios');
const config = require('../config/default');
const logger = require('../utils/logger');

class AlertDispatcher {
  constructor() {
    this.emailTransporter = null;
    this.dispatchers = new Map();
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  // Initialize the dispatcher
  async initialize() {
    try {
      // Initialize email transporter if configured
      if (config.alerts.email && config.alerts.email.smtp) {
        await this.initializeEmailTransporter();
      }

      // Register dispatch handlers
      this.dispatchers.set('email', this.dispatchEmail.bind(this));
      this.dispatchers.set('discord', this.dispatchDiscord.bind(this));
      this.dispatchers.set('slack', this.dispatchSlack.bind(this));
      this.dispatchers.set('webhook', this.dispatchWebhook.bind(this));
      this.dispatchers.set('dashboard', this.dispatchDashboard.bind(this));

      logger.info(`Alert dispatcher initialized with ${this.dispatchers.size} channels`);
    } catch (error) {
      logger.error('Failed to initialize alert dispatcher:', error);
      throw error;
    }
  }

  // Initialize email transporter
  async initializeEmailTransporter() {
    try {
      this.emailTransporter = nodemailer.createTransporter(config.alerts.email.smtp);
      
      // Verify connection
      await this.emailTransporter.verify();
      logger.info('Email transporter initialized and verified');
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
      this.emailTransporter = null;
    }
  }

  // Main dispatch method
  async dispatch(alert, channel) {
    const dispatcher = this.dispatchers.get(channel.type);
    if (!dispatcher) {
      throw new Error(`Unknown channel type: ${channel.type}`);
    }

    // Retry logic
    let lastError;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await dispatcher(alert, channel);
        logger.debug(`Alert dispatched to ${channel.type} on attempt ${attempt}`);
        return;
      } catch (error) {
        lastError = error;
        logger.warn(`Dispatch attempt ${attempt} failed for ${channel.type}:`, error.message);
        
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  // Email dispatcher
  async dispatchEmail(alert, channel) {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not initialized');
    }

    const emailContent = this.formatEmailContent(alert);
    
    const mailOptions = {
      from: config.alerts.email.from,
      to: channel.target,
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      html: emailContent.html,
      text: emailContent.text
    };

    await this.emailTransporter.sendMail(mailOptions);
    logger.info(`Email alert sent to ${channel.target}`);
  }

  // Discord dispatcher
  async dispatchDiscord(alert, channel) {
    if (!channel.target || channel.target === 'undefined') {
      throw new Error('Discord webhook URL not configured');
    }

    const embed = this.formatDiscordEmbed(alert);
    
    const payload = {
      embeds: [embed]
    };

    await axios.post(channel.target, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    logger.info('Discord alert sent');
  }

  // Slack dispatcher
  async dispatchSlack(alert, channel) {
    if (!channel.target || channel.target === 'undefined') {
      throw new Error('Slack webhook URL not configured');
    }

    const payload = this.formatSlackPayload(alert);

    await axios.post(channel.target, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    logger.info('Slack alert sent');
  }

  // Generic webhook dispatcher
  async dispatchWebhook(alert, channel) {
    const payload = {
      alert: {
        id: alert.alertId,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        timestamp: alert.createdAt,
        chainId: alert.chainId,
        networkName: alert.networkName,
        details: alert.details
      }
    };

    await axios.post(channel.target, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    logger.info(`Webhook alert sent to ${channel.target}`);
  }

  // Dashboard dispatcher (real-time via Socket.IO)
  async dispatchDashboard(alert, channel) {
    // This is handled by the AlertSystem's emitRealTimeUpdate method
    // Just log that it was processed
    logger.debug('Dashboard alert processed via Socket.IO');
  }

  // Format email content
  formatEmailContent(alert) {
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background-color: ${this.getSeverityColor(alert.severity)}; color: white; padding: 20px;">
              <h1 style="margin: 0; font-size: 24px;">${alert.title}</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Severity: ${alert.severity.toUpperCase()}</p>
            </div>
            <div style="padding: 20px;">
              <p style="font-size: 16px; line-height: 1.5; color: #333;">${alert.message}</p>
              
              ${alert.chainId ? `<p><strong>Network:</strong> ${alert.networkName} (Chain ID: ${alert.chainId})</p>` : ''}
              ${alert.details?.transactionHash ? `<p><strong>Transaction:</strong> <code>${alert.details.transactionHash}</code></p>` : ''}
              
              <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
                <h3 style="margin: 0 0 10px 0; color: #666;">Alert Details</h3>
                <pre style="font-size: 12px; color: #666; white-space: pre-wrap;">${JSON.stringify(alert.details || {}, null, 2)}</pre>
              </div>
              
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                <p>Alert ID: ${alert.alertId}</p>
                <p>Generated at: ${new Date(alert.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
${alert.title}
Severity: ${alert.severity.toUpperCase()}

${alert.message}

${alert.chainId ? `Network: ${alert.networkName} (Chain ID: ${alert.chainId})` : ''}
${alert.details?.transactionHash ? `Transaction: ${alert.details.transactionHash}` : ''}

Alert Details:
${JSON.stringify(alert.details || {}, null, 2)}

Alert ID: ${alert.alertId}
Generated at: ${new Date(alert.createdAt).toLocaleString()}
    `;

    return { html, text };
  }

  // Format Discord embed
  formatDiscordEmbed(alert) {
    const embed = {
      title: alert.title,
      description: alert.message,
      color: this.getSeverityColorInt(alert.severity),
      timestamp: alert.createdAt,
      fields: []
    };

    // Add network info
    if (alert.chainId) {
      embed.fields.push({
        name: 'Network',
        value: `${alert.networkName} (Chain ID: ${alert.chainId})`,
        inline: true
      });
    }

    // Add transaction hash
    if (alert.details?.transactionHash) {
      embed.fields.push({
        name: 'Transaction',
        value: `\`${alert.details.transactionHash}\``,
        inline: true
      });
    }

    // Add severity
    embed.fields.push({
      name: 'Severity',
      value: alert.severity.toUpperCase(),
      inline: true
    });

    // Add alert ID
    embed.footer = {
      text: `Alert ID: ${alert.alertId}`
    };

    return embed;
  }

  // Format Slack payload
  formatSlackPayload(alert) {
    const color = this.getSeverityColor(alert.severity);
    
    const attachment = {
      color: color,
      title: alert.title,
      text: alert.message,
      fields: [
        {
          title: 'Severity',
          value: alert.severity.toUpperCase(),
          short: true
        }
      ],
      footer: `Alert ID: ${alert.alertId}`,
      ts: Math.floor(new Date(alert.createdAt).getTime() / 1000)
    };

    // Add network info
    if (alert.chainId) {
      attachment.fields.push({
        title: 'Network',
        value: `${alert.networkName} (Chain ID: ${alert.chainId})`,
        short: true
      });
    }

    // Add transaction hash
    if (alert.details?.transactionHash) {
      attachment.fields.push({
        title: 'Transaction',
        value: alert.details.transactionHash,
        short: false
      });
    }

    return {
      attachments: [attachment]
    };
  }

  // Get color for severity level
  getSeverityColor(severity) {
    const colors = {
      critical: '#dc3545',
      high: '#fd7e14',
      error: '#dc3545',
      warning: '#ffc107',
      medium: '#17a2b8',
      info: '#17a2b8',
      low: '#28a745'
    };
    return colors[severity] || '#6c757d';
  }

  // Get color as integer for Discord
  getSeverityColorInt(severity) {
    const colors = {
      critical: 0xdc3545,
      high: 0xfd7e14,
      error: 0xdc3545,
      warning: 0xffc107,
      medium: 0x17a2b8,
      info: 0x17a2b8,
      low: 0x28a745
    };
    return colors[severity] || 0x6c757d;
  }

  // Utility delay function
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Shutdown the dispatcher
  async shutdown() {
    try {
      if (this.emailTransporter) {
        this.emailTransporter.close();
      }
      logger.info('Alert dispatcher shutdown completed');
    } catch (error) {
      logger.error('Error during alert dispatcher shutdown:', error);
    }
  }
}

module.exports = AlertDispatcher;
