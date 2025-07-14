const { Anomaly } = require('../models');
const logger = require('../../utils/logger');

class AnomalyOperations {
  
  // Create a new anomaly
  static async create(anomalyData) {
    try {
      const anomaly = new Anomaly(anomalyData);
      await anomaly.save();
      logger.info(`Anomaly created: ${anomaly.type} on chain ${anomaly.chainId}`);
      return anomaly;
    } catch (error) {
      logger.error('Error creating anomaly:', error);
      throw error;
    }
  }

  // Find anomaly by ID
  static async findById(anomalyId) {
    try {
      return await Anomaly.findById(anomalyId)
        .populate('transactionId')
        .populate('relatedTransactionIds');
    } catch (error) {
      logger.error('Error finding anomaly by ID:', error);
      throw error;
    }
  }

  // Get paginated anomalies
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
        sortBy = 'detectedAt',
        sortOrder = 'desc'
      } = options;

      const query = {};
      
      if (type) query.type = type;
      if (severity) query.severity = severity;
      if (status) query.status = status;
      if (chainId) query.chainId = chainId;
      
      if (startDate || endDate) {
        query.detectedAt = {};
        if (startDate) query.detectedAt.$gte = new Date(startDate);
        if (endDate) query.detectedAt.$lte = new Date(endDate);
      }

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (page - 1) * limit;

      const [anomalies, total] = await Promise.all([
        Anomaly.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('transactionId')
          .populate('relatedTransactionIds'),
        Anomaly.countDocuments(query)
      ]);

      return {
        anomalies,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting paginated anomalies:', error);
      throw error;
    }
  }

  // Find active anomalies
  static async findActive(chainId = null) {
    try {
      return await Anomaly.findActive(chainId);
    } catch (error) {
      logger.error('Error finding active anomalies:', error);
      throw error;
    }
  }

  // Find anomalies by severity
  static async findBySeverity(severity, limit = 100) {
    try {
      return await Anomaly.findBySeverity(severity, limit);
    } catch (error) {
      logger.error('Error finding anomalies by severity:', error);
      throw error;
    }
  }

  // Resolve anomaly
  static async resolve(anomalyId, resolvedBy, notes) {
    try {
      const anomaly = await Anomaly.findById(anomalyId);
      if (!anomaly) {
        throw new Error('Anomaly not found');
      }
      
      await anomaly.resolve(resolvedBy, notes);
      logger.info(`Anomaly resolved: ${anomaly.anomalyId} by ${resolvedBy}`);
      return anomaly;
    } catch (error) {
      logger.error('Error resolving anomaly:', error);
      throw error;
    }
  }

  // Mark as false positive
  static async markAsFalsePositive(anomalyId, resolvedBy, notes) {
    try {
      const anomaly = await Anomaly.findById(anomalyId);
      if (!anomaly) {
        throw new Error('Anomaly not found');
      }
      
      await anomaly.markAsFalsePositive(resolvedBy, notes);
      logger.info(`Anomaly marked as false positive: ${anomaly.anomalyId} by ${resolvedBy}`);
      return anomaly;
    } catch (error) {
      logger.error('Error marking anomaly as false positive:', error);
      throw error;
    }
  }

  // Add alert to anomaly
  static async addAlert(anomalyId, channel, status, response, error) {
    try {
      const anomaly = await Anomaly.findById(anomalyId);
      if (!anomaly) {
        throw new Error('Anomaly not found');
      }
      
      await anomaly.addAlert(channel, status, response, error);
      return anomaly;
    } catch (error) {
      logger.error('Error adding alert to anomaly:', error);
      throw error;
    }
  }

  // Update severity
  static async updateSeverity(anomalyId, newSeverity) {
    try {
      const anomaly = await Anomaly.findById(anomalyId);
      if (!anomaly) {
        throw new Error('Anomaly not found');
      }
      
      await anomaly.updateSeverity(newSeverity);
      logger.info(`Anomaly severity updated: ${anomaly.anomalyId} -> ${newSeverity}`);
      return anomaly;
    } catch (error) {
      logger.error('Error updating anomaly severity:', error);
      throw error;
    }
  }

  // Get statistics by type
  static async getStatsByType(startDate, endDate) {
    try {
      return await Anomaly.getStatsByType(startDate, endDate);
    } catch (error) {
      logger.error('Error getting anomaly statistics by type:', error);
      throw error;
    }
  }

  // Find duplicate transaction anomalies
  static async findDuplicates(transactionHash, chainId, timeWindow) {
    try {
      return await Anomaly.findDuplicates(transactionHash, chainId, timeWindow);
    } catch (error) {
      logger.error('Error finding duplicate anomalies:', error);
      throw error;
    }
  }

  // Get anomaly counts by status
  static async getStatusCounts(chainId = null, timeRange = null) {
    try {
      const match = {};
      if (chainId) match.chainId = chainId;
      if (timeRange) {
        match.detectedAt = {
          $gte: new Date(Date.now() - timeRange)
        };
      }

      const result = await Anomaly.aggregate([
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
      logger.error('Error getting anomaly status counts:', error);
      throw error;
    }
  }

  // Auto-resolve expired anomalies
  static async autoResolveExpired() {
    try {
      const result = await Anomaly.updateMany(
        {
          autoResolve: true,
          autoResolveAfter: { $lte: new Date() },
          status: 'active'
        },
        {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: 'system',
          resolutionNotes: 'Auto-resolved due to expiration'
        }
      );

      if (result.modifiedCount > 0) {
        logger.info(`Auto-resolved ${result.modifiedCount} expired anomalies`);
      }

      return result.modifiedCount;
    } catch (error) {
      logger.error('Error auto-resolving expired anomalies:', error);
      throw error;
    }
  }

  // Delete old resolved anomalies (cleanup)
  static async deleteOldResolved(olderThanDays = 30) {
    try {
      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
      const result = await Anomaly.deleteMany({
        resolvedAt: { $lt: cutoffDate },
        status: { $in: ['resolved', 'false_positive'] }
      });
      
      logger.info(`Deleted ${result.deletedCount} old resolved anomalies`);
      return result.deletedCount;
    } catch (error) {
      logger.error('Error deleting old anomalies:', error);
      throw error;
    }
  }
}

module.exports = AnomalyOperations;
