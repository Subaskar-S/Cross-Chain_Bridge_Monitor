const { Alert } = require('../models');
const logger = require('../../utils/logger');

class AlertOperations {
  
  // Create a new alert
  static async create(alertData) {
    try {
      const alert = new Alert(alertData);
      await alert.save();
      logger.info(`Alert created: ${alert.type} - ${alert.title}`);
      return alert;
    } catch (error) {
      logger.error('Error creating alert:', error);
      throw error;
    }
  }

  // Find alert by ID
  static async findById(alertId) {
    try {
      return await Alert.findById(alertId)
        .populate('anomalyId')
        .populate('transactionId');
    } catch (error) {
      logger.error('Error finding alert by ID:', error);
      throw error;
    }
  }

  // Get paginated alerts
  static async getPaginated(options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        type,
        severity,
        status,
        chainId,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const query = {};
      
      if (type) query.type = type;
      if (severity) query.severity = severity;
      if (status) query.status = status;
      if (chainId) query.chainId = chainId;
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (page - 1) * limit;

      const [alerts, total] = await Promise.all([
        Alert.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('anomalyId')
          .populate('transactionId'),
        Alert.countDocuments(query)
      ]);

      return {
        alerts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting paginated alerts:', error);
      throw error;
    }
  }

  // Find pending alerts
  static async findPending(limit = 100) {
    try {
      return await Alert.findPending(limit);
    } catch (error) {
      logger.error('Error finding pending alerts:', error);
      throw error;
    }
  }

  // Find alerts for retry
  static async findForRetry() {
    try {
      return await Alert.findForRetry();
    } catch (error) {
      logger.error('Error finding alerts for retry:', error);
      throw error;
    }
  }

  // Acknowledge alert
  static async acknowledge(alertId, acknowledgedBy, notes) {
    try {
      const alert = await Alert.findById(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      await alert.acknowledge(acknowledgedBy, notes);
      logger.info(`Alert acknowledged: ${alert.alertId} by ${acknowledgedBy}`);
      return alert;
    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  // Resolve alert
  static async resolve(alertId, resolvedBy, notes) {
    try {
      const alert = await Alert.findById(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      await alert.resolve(resolvedBy, notes);
      logger.info(`Alert resolved: ${alert.alertId} by ${resolvedBy}`);
      return alert;
    } catch (error) {
      logger.error('Error resolving alert:', error);
      throw error;
    }
  }

  // Mark alert as sent
  static async markAsSent(alertId, channel) {
    try {
      const alert = await Alert.findById(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      await alert.markAsSent(channel);
      return alert;
    } catch (error) {
      logger.error('Error marking alert as sent:', error);
      throw error;
    }
  }

  // Mark alert as failed
  static async markAsFailed(alertId, channel, error) {
    try {
      const alert = await Alert.findById(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      await alert.markAsFailed(channel, error);
      return alert;
    } catch (error) {
      logger.error('Error marking alert as failed:', error);
      throw error;
    }
  }

  // Add note to alert
  static async addNote(alertId, author, content) {
    try {
      const alert = await Alert.findById(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      await alert.addNote(author, content);
      return alert;
    } catch (error) {
      logger.error('Error adding note to alert:', error);
      throw error;
    }
  }

  // Find alerts by group key (for deduplication)
  static async findByGroupKey(groupKey, timeWindow = 60000) {
    try {
      return await Alert.findByGroupKey(groupKey, timeWindow);
    } catch (error) {
      logger.error('Error finding alerts by group key:', error);
      throw error;
    }
  }

  // Get statistics by status
  static async getStatsByStatus(startDate, endDate) {
    try {
      return await Alert.getStatsByStatus(startDate, endDate);
    } catch (error) {
      logger.error('Error getting alert statistics by status:', error);
      throw error;
    }
  }

  // Get alert counts by status
  static async getStatusCounts(chainId = null, timeRange = null) {
    try {
      const match = {};
      if (chainId) match.chainId = chainId;
      if (timeRange) {
        match.createdAt = {
          $gte: new Date(Date.now() - timeRange)
        };
      }

      const result = await Alert.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              status: '$status',
              severity: '$severity'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.status',
            severityBreakdown: {
              $push: {
                severity: '$_id.severity',
                count: '$count'
              }
            },
            totalCount: { $sum: '$count' }
          }
        }
      ]);

      return result;
    } catch (error) {
      logger.error('Error getting alert status counts:', error);
      throw error;
    }
  }

  // Check for duplicate alerts and mark them
  static async checkForDuplicates(alert) {
    try {
      const existingAlerts = await Alert.findByGroupKey(alert.groupKey, 60000); // 1 minute window
      
      if (existingAlerts.length > 0) {
        const originalAlert = existingAlerts[0];
        
        // Mark current alert as duplicate
        alert.isDuplicate = true;
        alert.originalAlertId = originalAlert._id;
        await alert.save();
        
        // Update duplicate count on original
        originalAlert.duplicateCount += 1;
        await originalAlert.save();
        
        logger.info(`Duplicate alert detected: ${alert.alertId} -> ${originalAlert.alertId}`);
        return { isDuplicate: true, originalAlert };
      }
      
      return { isDuplicate: false };
    } catch (error) {
      logger.error('Error checking for duplicate alerts:', error);
      throw error;
    }
  }

  // Auto-resolve expired alerts
  static async autoResolveExpired() {
    try {
      const result = await Alert.updateMany(
        {
          autoResolve: true,
          autoResolveAfter: { $lte: new Date() },
          status: { $in: ['pending', 'sent', 'acknowledged'] }
        },
        {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: 'system'
        }
      );

      if (result.modifiedCount > 0) {
        logger.info(`Auto-resolved ${result.modifiedCount} expired alerts`);
      }

      return result.modifiedCount;
    } catch (error) {
      logger.error('Error auto-resolving expired alerts:', error);
      throw error;
    }
  }

  // Delete old resolved alerts (cleanup)
  static async deleteOldResolved(olderThanDays = 7) {
    try {
      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
      const result = await Alert.deleteMany({
        resolvedAt: { $lt: cutoffDate },
        status: 'resolved'
      });
      
      logger.info(`Deleted ${result.deletedCount} old resolved alerts`);
      return result.deletedCount;
    } catch (error) {
      logger.error('Error deleting old alerts:', error);
      throw error;
    }
  }

  // Get recent alerts for dashboard
  static async getRecentAlerts(limit = 20, severity = null) {
    try {
      const query = { status: { $ne: 'resolved' } };
      if (severity) query.severity = severity;
      
      return await Alert.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('anomalyId')
        .populate('transactionId');
    } catch (error) {
      logger.error('Error getting recent alerts:', error);
      throw error;
    }
  }
}

module.exports = AlertOperations;
