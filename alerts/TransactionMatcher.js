const { TransactionOperations } = require('../db/operations');
const logger = require('../utils/logger');

class TransactionMatcher {
  constructor(alertSystem) {
    this.alertSystem = alertSystem;
    this.matchingInterval = null;
    this.isMatching = false;
    this.matchingIntervalMs = 30000; // 30 seconds
  }

  // Start the transaction matching process
  start() {
    this.matchingInterval = setInterval(async () => {
      if (!this.isMatching) {
        await this.performMatching();
      }
    }, this.matchingIntervalMs);

    logger.info('Transaction matcher started');
  }

  // Stop the transaction matching process
  stop() {
    if (this.matchingInterval) {
      clearInterval(this.matchingInterval);
      this.matchingInterval = null;
    }
    logger.info('Transaction matcher stopped');
  }

  // Perform transaction matching
  async performMatching() {
    this.isMatching = true;

    try {
      logger.debug('Starting transaction matching cycle');

      // Get unmatched transactions from all chains
      const networks = [1, 137, 56]; // Ethereum, Polygon, BSC
      const maxAge = 60 * 60 * 1000; // 1 hour

      for (const chainId of networks) {
        await this.matchTransactionsForChain(chainId, maxAge);
      }

      logger.debug('Transaction matching cycle completed');
    } catch (error) {
      logger.error('Error in transaction matching:', error);
    } finally {
      this.isMatching = false;
    }
  }

  // Match transactions for a specific chain
  async matchTransactionsForChain(chainId, maxAge) {
    try {
      const unmatchedTransactions = await TransactionOperations.findUnmatched(chainId, maxAge);
      
      logger.debug(`Found ${unmatchedTransactions.length} unmatched transactions for chain ${chainId}`);

      for (const transaction of unmatchedTransactions) {
        await this.findMatchForTransaction(transaction);
      }
    } catch (error) {
      logger.error(`Error matching transactions for chain ${chainId}:`, error);
    }
  }

  // Find a match for a specific transaction
  async findMatchForTransaction(transaction) {
    try {
      // Skip if already matched
      if (transaction.isMatched) {
        return;
      }

      // Only match Lock/Burn with Unlock/Mint
      const matchingEventTypes = this.getMatchingEventTypes(transaction.eventType);
      if (!matchingEventTypes.length) {
        return;
      }

      // Look for matching transaction by bridgeId
      if (transaction.bridgeId) {
        const potentialMatches = await TransactionOperations.findByBridgeId(transaction.bridgeId);
        
        for (const potentialMatch of potentialMatches) {
          if (await this.isValidMatch(transaction, potentialMatch)) {
            await this.matchTransactions(transaction, potentialMatch);
            return;
          }
        }
      }

      // If no bridgeId match found, try fuzzy matching
      await this.performFuzzyMatching(transaction);
    } catch (error) {
      logger.error(`Error finding match for transaction ${transaction.txHash}:`, error);
    }
  }

  // Get matching event types
  getMatchingEventTypes(eventType) {
    const matchingMap = {
      'Lock': ['Unlock', 'Mint'],
      'Burn': ['Unlock', 'Mint'],
      'Unlock': ['Lock', 'Burn'],
      'Mint': ['Lock', 'Burn']
    };
    return matchingMap[eventType] || [];
  }

  // Check if two transactions are a valid match
  async isValidMatch(tx1, tx2) {
    try {
      // Can't match with itself
      if (tx1._id.toString() === tx2._id.toString()) {
        return false;
      }

      // Both already matched
      if (tx1.isMatched && tx2.isMatched) {
        return false;
      }

      // Must be different chains
      if (tx1.chainId === tx2.chainId) {
        return false;
      }

      // Must be matching event types
      const matchingTypes = this.getMatchingEventTypes(tx1.eventType);
      if (!matchingTypes.includes(tx2.eventType)) {
        return false;
      }

      // Must have same bridgeId if available
      if (tx1.bridgeId && tx2.bridgeId && tx1.bridgeId !== tx2.bridgeId) {
        return false;
      }

      // Must be same token (or equivalent)
      if (!this.areTokensEquivalent(tx1, tx2)) {
        return false;
      }

      // Amount should be similar (within tolerance)
      if (!this.areAmountsSimilar(tx1.amountFormatted, tx2.amountFormatted)) {
        return false;
      }

      // Time difference should be reasonable (within 1 hour)
      const timeDiff = Math.abs(tx1.timestamp - tx2.timestamp);
      if (timeDiff > 60 * 60 * 1000) {
        return false;
      }

      // Check cross-chain relationship
      if (!this.isValidCrossChainPair(tx1, tx2)) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating transaction match:', error);
      return false;
    }
  }

  // Check if tokens are equivalent across chains
  areTokensEquivalent(tx1, tx2) {
    // Simple symbol comparison - in production, this would use a token mapping database
    return tx1.tokenSymbol === tx2.tokenSymbol;
  }

  // Check if amounts are similar (within 1% tolerance)
  areAmountsSimilar(amount1, amount2, tolerance = 0.01) {
    if (amount1 === 0 && amount2 === 0) return true;
    if (amount1 === 0 || amount2 === 0) return false;

    const diff = Math.abs(amount1 - amount2);
    const average = (amount1 + amount2) / 2;
    const percentDiff = diff / average;

    return percentDiff <= tolerance;
  }

  // Check if it's a valid cross-chain pair
  isValidCrossChainPair(tx1, tx2) {
    // Check if target chain matches source chain
    if (tx1.targetChainId && tx1.targetChainId !== tx2.chainId) {
      return false;
    }
    if (tx2.targetChainId && tx2.targetChainId !== tx1.chainId) {
      return false;
    }

    return true;
  }

  // Perform fuzzy matching when bridgeId is not available
  async performFuzzyMatching(transaction) {
    try {
      const matchingEventTypes = this.getMatchingEventTypes(transaction.eventType);
      if (!matchingEventTypes.length) return;

      // Search for potential matches in other chains
      const searchCriteria = {
        tokenSymbol: transaction.tokenSymbol,
        amountFormatted: transaction.amountFormatted,
        startDate: new Date(transaction.timestamp.getTime() - 30 * 60 * 1000), // 30 minutes before
        endDate: new Date(transaction.timestamp.getTime() + 30 * 60 * 1000), // 30 minutes after
        limit: 20
      };

      // Search in other chains
      const otherChains = [1, 137, 56].filter(chainId => chainId !== transaction.chainId);
      
      for (const chainId of otherChains) {
        const potentialMatches = await TransactionOperations.getPaginated({
          ...searchCriteria,
          chainId
        });

        for (const potentialMatch of potentialMatches.transactions) {
          if (matchingEventTypes.includes(potentialMatch.eventType) && 
              await this.isValidMatch(transaction, potentialMatch)) {
            
            // Lower confidence for fuzzy matches
            await this.matchTransactions(transaction, potentialMatch, 0.7);
            return;
          }
        }
      }
    } catch (error) {
      logger.error('Error in fuzzy matching:', error);
    }
  }

  // Match two transactions
  async matchTransactions(tx1, tx2, confidence = 0.9) {
    try {
      await TransactionOperations.matchTransactions(tx1, tx2);
      
      logger.info(`Transactions matched: ${tx1.txHash} (${tx1.networkName}) <-> ${tx2.txHash} (${tx2.networkName})`);

      // Emit real-time update
      if (this.alertSystem) {
        this.alertSystem.emitRealTimeUpdate('transaction_matched', {
          sourceTransaction: {
            hash: tx1.txHash,
            network: tx1.networkName,
            amount: tx1.amountFormatted,
            token: tx1.tokenSymbol
          },
          targetTransaction: {
            hash: tx2.txHash,
            network: tx2.networkName,
            amount: tx2.amountFormatted,
            token: tx2.tokenSymbol
          },
          confidence: confidence,
          matchedAt: new Date()
        });
      }

      // Send success alert for high-value matches
      if (tx1.amountFormatted > 10000 || tx2.amountFormatted > 10000) {
        await this.alertSystem.sendAlert({
          type: 'bridge_success',
          severity: 'info',
          title: 'High-Value Bridge Transaction Completed',
          message: `Cross-chain transaction successfully matched: ${tx1.amountFormatted} ${tx1.tokenSymbol}`,
          details: {
            sourceHash: tx1.txHash,
            targetHash: tx2.txHash,
            sourceNetwork: tx1.networkName,
            targetNetwork: tx2.networkName,
            amount: tx1.amountFormatted,
            token: tx1.tokenSymbol,
            confidence: confidence
          }
        });
      }
    } catch (error) {
      logger.error('Error matching transactions:', error);
    }
  }

  // Check for timeout transactions and mark them
  async checkForTimeouts() {
    try {
      const timeoutMs = 30 * 60 * 1000; // 30 minutes
      const cutoffTime = new Date(Date.now() - timeoutMs);

      // Find old unmatched transactions
      const networks = [1, 137, 56];
      
      for (const chainId of networks) {
        const oldTransactions = await TransactionOperations.getPaginated({
          chainId,
          status: 'pending',
          isMatched: false,
          endDate: cutoffTime,
          limit: 100
        });

        for (const transaction of oldTransactions.transactions) {
          // Only timeout outgoing transactions (Lock/Burn)
          if (['Lock', 'Burn'].includes(transaction.eventType)) {
            await TransactionOperations.markAsTimeout(transaction._id);
            
            // Send timeout alert
            await this.alertSystem.sendAlert({
              type: 'bridge_timeout',
              severity: 'high',
              title: 'Bridge Transaction Timeout',
              message: `Transaction ${transaction.txHash} has timed out after ${timeoutMs / (60 * 1000)} minutes`,
              transactionId: transaction._id,
              chainId: transaction.chainId,
              networkName: transaction.networkName,
              details: {
                transactionHash: transaction.txHash,
                amount: transaction.amountFormatted,
                token: transaction.tokenSymbol,
                targetChain: transaction.targetChainId,
                timeoutDuration: Date.now() - transaction.timestamp.getTime()
              }
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error checking for timeouts:', error);
    }
  }

  // Get matching statistics
  getStats() {
    return {
      isMatching: this.isMatching,
      matchingInterval: this.matchingIntervalMs
    };
  }
}

module.exports = TransactionMatcher;
