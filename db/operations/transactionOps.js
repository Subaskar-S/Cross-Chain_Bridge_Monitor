const { Transaction } = require('../models');
const logger = require('../../utils/logger');

class TransactionOperations {
  
  // Create a new transaction
  static async create(transactionData) {
    try {
      const transaction = new Transaction(transactionData);
      await transaction.save();
      logger.info(`Transaction created: ${transaction.txHash} on chain ${transaction.chainId}`);
      return transaction;
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error - transaction already exists
        logger.debug(`Duplicate transaction ignored: ${transactionData.txHash}`);
        return null;
      }
      logger.error('Error creating transaction:', error);
      throw error;
    }
  }

  // Find transaction by hash and chain
  static async findByHash(txHash, chainId) {
    try {
      return await Transaction.findOne({ txHash, chainId });
    } catch (error) {
      logger.error('Error finding transaction by hash:', error);
      throw error;
    }
  }

  // Find transactions by bridge ID
  static async findByBridgeId(bridgeId) {
    try {
      return await Transaction.findByBridgeId(bridgeId);
    } catch (error) {
      logger.error('Error finding transactions by bridge ID:', error);
      throw error;
    }
  }

  // Get paginated transactions
  static async getPaginated(options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        chainId,
        status,
        tokenAddress,
        from,
        to,
        startDate,
        endDate,
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = options;

      const query = {};
      
      if (chainId) query.chainId = chainId;
      if (status) query.status = status;
      if (tokenAddress) query.tokenAddress = tokenAddress;
      if (from) query.from = from;
      if (to) query.to = to;
      
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (page - 1) * limit;

      const [transactions, total] = await Promise.all([
        Transaction.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('matchedTransactionId'),
        Transaction.countDocuments(query)
      ]);

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting paginated transactions:', error);
      throw error;
    }
  }

  // Find unmatched transactions
  static async findUnmatched(chainId, maxAgeMs = 30 * 60 * 1000) {
    try {
      return await Transaction.findUnmatched(chainId, maxAgeMs);
    } catch (error) {
      logger.error('Error finding unmatched transactions:', error);
      throw error;
    }
  }

  // Match cross-chain transactions
  static async matchTransactions(sourceTransaction, targetTransaction) {
    try {
      await Promise.all([
        sourceTransaction.markAsMatched(targetTransaction._id),
        targetTransaction.markAsMatched(sourceTransaction._id)
      ]);
      
      logger.info(`Transactions matched: ${sourceTransaction.txHash} <-> ${targetTransaction.txHash}`);
      return { sourceTransaction, targetTransaction };
    } catch (error) {
      logger.error('Error matching transactions:', error);
      throw error;
    }
  }

  // Mark transaction as timeout
  static async markAsTimeout(transactionId) {
    try {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }
      
      await transaction.markAsTimeout();
      logger.info(`Transaction marked as timeout: ${transaction.txHash}`);
      return transaction;
    } catch (error) {
      logger.error('Error marking transaction as timeout:', error);
      throw error;
    }
  }

  // Get volume statistics
  static async getVolumeStats(startDate, endDate, chainId = null) {
    try {
      return await Transaction.getVolumeStats(startDate, endDate, chainId);
    } catch (error) {
      logger.error('Error getting volume statistics:', error);
      throw error;
    }
  }

  // Get transaction counts by status
  static async getStatusCounts(chainId = null, timeRange = null) {
    try {
      const match = {};
      if (chainId) match.chainId = chainId;
      if (timeRange) {
        match.timestamp = {
          $gte: new Date(Date.now() - timeRange)
        };
      }

      const result = await Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      return result.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});
    } catch (error) {
      logger.error('Error getting status counts:', error);
      throw error;
    }
  }

  // Update transaction status
  static async updateStatus(transactionId, status) {
    try {
      const transaction = await Transaction.findByIdAndUpdate(
        transactionId,
        { status },
        { new: true }
      );
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }
      
      logger.info(`Transaction status updated: ${transaction.txHash} -> ${status}`);
      return transaction;
    } catch (error) {
      logger.error('Error updating transaction status:', error);
      throw error;
    }
  }

  // Delete old transactions (cleanup)
  static async deleteOldTransactions(olderThanDays = 90) {
    try {
      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
      const result = await Transaction.deleteMany({
        timestamp: { $lt: cutoffDate },
        status: { $in: ['completed', 'failed'] }
      });
      
      logger.info(`Deleted ${result.deletedCount} old transactions`);
      return result.deletedCount;
    } catch (error) {
      logger.error('Error deleting old transactions:', error);
      throw error;
    }
  }
}

module.exports = TransactionOperations;
