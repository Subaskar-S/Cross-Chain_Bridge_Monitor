const { TransactionOperations, AnomalyOperations } = require('../db/operations');
const config = require('../config/default');
const logger = require('../utils/logger');

class AnomalyDetector {
  constructor(alertSystem) {
    this.alertSystem = alertSystem;
    this.rules = config.anomalyRules;
    this.detectionHandlers = new Map();
    this.processingQueue = [];
    this.isProcessing = false;
    
    // Initialize detection handlers
    this.initializeDetectionHandlers();
  }

  // Initialize all anomaly detection handlers
  initializeDetectionHandlers() {
    this.detectionHandlers.set('bridge_timeout', this.detectBridgeTimeout.bind(this));
    this.detectionHandlers.set('value_mismatch', this.detectValueMismatch.bind(this));
    this.detectionHandlers.set('duplicate_transaction', this.detectDuplicateTransaction.bind(this));
    this.detectionHandlers.set('suspicious_contract', this.detectSuspiciousContract.bind(this));
    this.detectionHandlers.set('unusual_volume', this.detectUnusualVolume.bind(this));
    this.detectionHandlers.set('failed_verification', this.detectFailedVerification.bind(this));
    this.detectionHandlers.set('replay_attack', this.detectReplayAttack.bind(this));
    this.detectionHandlers.set('gas_anomaly', this.detectGasAnomaly.bind(this));

    logger.info(`Anomaly detector initialized with ${this.detectionHandlers.size} detection rules`);
  }

  // Main entry point for anomaly detection
  async checkTransaction(transaction) {
    try {
      // Add to processing queue
      this.processingQueue.push(transaction);
      
      // Process queue if not already processing
      if (!this.isProcessing) {
        await this.processQueue();
      }
    } catch (error) {
      logger.error('Error in anomaly detection:', error);
    }
  }

  // Process the anomaly detection queue
  async processQueue() {
    this.isProcessing = true;
    
    try {
      while (this.processingQueue.length > 0) {
        const transaction = this.processingQueue.shift();
        await this.analyzeTransaction(transaction);
      }
    } catch (error) {
      logger.error('Error processing anomaly detection queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Analyze a single transaction for anomalies
  async analyzeTransaction(transaction) {
    try {
      logger.debug(`Analyzing transaction for anomalies: ${transaction.txHash}`);

      // Run all enabled detection rules
      const detectionPromises = [];
      
      for (const [ruleName, handler] of this.detectionHandlers) {
        if (this.isRuleEnabled(ruleName)) {
          detectionPromises.push(
            handler(transaction).catch(error => {
              logger.error(`Error in ${ruleName} detection:`, error);
              return null;
            })
          );
        }
      }

      // Wait for all detections to complete
      const results = await Promise.all(detectionPromises);
      
      // Process results and create anomalies
      for (const result of results) {
        if (result && result.isAnomaly) {
          await this.createAnomaly(result, transaction);
        }
      }
    } catch (error) {
      logger.error(`Error analyzing transaction ${transaction.txHash}:`, error);
    }
  }

  // Check if a detection rule is enabled
  isRuleEnabled(ruleName) {
    return this.rules[ruleName] && this.rules[ruleName].enabled;
  }

  // Create an anomaly record and send alerts
  async createAnomaly(detectionResult, transaction) {
    try {
      const anomalyData = {
        type: detectionResult.type,
        severity: detectionResult.severity,
        status: 'active',
        transactionId: transaction._id,
        chainId: transaction.chainId,
        networkName: transaction.networkName,
        contractAddress: transaction.bridgeContract,
        title: detectionResult.title,
        description: detectionResult.description,
        anomalyData: detectionResult.data,
        detectionRule: detectionResult.rule,
        confidence: detectionResult.confidence || 0.8
      };

      const anomaly = await AnomalyOperations.create(anomalyData);
      
      if (anomaly) {
        logger.info(`Anomaly detected: ${anomaly.type} for transaction ${transaction.txHash}`);
        
        // Send alert through alert system
        await this.alertSystem.sendAlert({
          type: 'anomaly_detected',
          severity: anomaly.severity,
          title: anomaly.title,
          message: anomaly.description,
          anomalyId: anomaly._id,
          transactionId: transaction._id,
          chainId: transaction.chainId,
          networkName: transaction.networkName,
          details: {
            anomalyType: anomaly.type,
            transactionHash: transaction.txHash,
            confidence: anomaly.confidence,
            ...detectionResult.data
          }
        });
      }
    } catch (error) {
      logger.error('Error creating anomaly:', error);
    }
  }

  // Detection Rule: Bridge Timeout
  async detectBridgeTimeout(transaction) {
    try {
      if (!this.rules.bridgeTimeout.enabled) return null;

      // Only check for Lock and Burn events (outgoing transactions)
      if (!['Lock', 'Burn'].includes(transaction.eventType)) {
        return null;
      }

      // Check if transaction has been matched within timeout window
      const timeoutMs = this.rules.bridgeTimeout.timeoutMs;
      const cutoffTime = new Date(transaction.timestamp.getTime() + timeoutMs);
      
      if (new Date() < cutoffTime) {
        // Still within timeout window
        return null;
      }

      // Check if transaction is still unmatched
      if (!transaction.isMatched && transaction.status === 'pending') {
        return {
          isAnomaly: true,
          type: 'bridge_timeout',
          severity: 'high',
          title: 'Bridge Transaction Timeout',
          description: `Transaction has not been completed on target chain within ${timeoutMs / (60 * 1000)} minutes`,
          rule: 'bridge_timeout',
          confidence: 0.9,
          data: {
            timeoutDuration: Date.now() - transaction.timestamp.getTime(),
            expectedCompletionTime: cutoffTime,
            targetChainId: transaction.targetChainId,
            bridgeId: transaction.bridgeId
          }
        };
      }

      return null;
    } catch (error) {
      logger.error('Error in bridge timeout detection:', error);
      return null;
    }
  }

  // Detection Rule: Value Mismatch
  async detectValueMismatch(transaction) {
    try {
      if (!this.rules.valueMismatch.enabled) return null;

      // Only check matched transactions
      if (!transaction.isMatched || !transaction.matchedTransactionId) {
        return null;
      }

      // Get the matched transaction
      const matchedTransaction = await TransactionOperations.findById(transaction.matchedTransactionId);
      if (!matchedTransaction) return null;

      // Compare amounts
      const tolerance = this.rules.valueMismatch.tolerancePercent / 100;
      const amountDiff = Math.abs(transaction.amountFormatted - matchedTransaction.amountFormatted);
      const averageAmount = (transaction.amountFormatted + matchedTransaction.amountFormatted) / 2;
      const discrepancyPercent = (amountDiff / averageAmount) * 100;

      if (discrepancyPercent > (tolerance * 100)) {
        return {
          isAnomaly: true,
          type: 'value_mismatch',
          severity: discrepancyPercent > 5 ? 'critical' : 'high',
          title: 'Cross-Chain Value Mismatch',
          description: `Significant value discrepancy detected between cross-chain transactions: ${discrepancyPercent.toFixed(2)}%`,
          rule: 'value_mismatch',
          confidence: 0.95,
          data: {
            expectedValue: transaction.amount,
            actualValue: matchedTransaction.amount,
            discrepancyPercent: discrepancyPercent,
            sourceTransaction: transaction.txHash,
            targetTransaction: matchedTransaction.txHash
          }
        };
      }

      return null;
    } catch (error) {
      logger.error('Error in value mismatch detection:', error);
      return null;
    }
  }

  // Detection Rule: Duplicate Transaction
  async detectDuplicateTransaction(transaction) {
    try {
      if (!this.rules.duplicateTransaction.enabled) return null;

      const windowMs = this.rules.duplicateTransaction.windowMs;
      const cutoffTime = new Date(Date.now() - windowMs);

      // Look for similar transactions within the time window
      const similarTransactions = await TransactionOperations.getPaginated({
        chainId: transaction.chainId,
        from: transaction.from,
        to: transaction.to,
        tokenAddress: transaction.tokenAddress,
        amount: transaction.amount,
        startDate: cutoffTime,
        limit: 10
      });

      // Check for exact duplicates (excluding current transaction)
      const duplicates = similarTransactions.transactions.filter(tx => 
        tx._id.toString() !== transaction._id.toString() &&
        tx.bridgeId === transaction.bridgeId &&
        tx.amount === transaction.amount
      );

      if (duplicates.length > 0) {
        const originalTx = duplicates[0];
        const timeBetween = Math.abs(transaction.timestamp - originalTx.timestamp);

        return {
          isAnomaly: true,
          type: 'duplicate_transaction',
          severity: 'high',
          title: 'Duplicate Transaction Detected',
          description: `Potential duplicate or replay attack detected`,
          rule: 'duplicate_transaction',
          confidence: 0.85,
          data: {
            originalTransactionHash: originalTx.txHash,
            duplicateTransactionHash: transaction.txHash,
            timeBetweenDuplicates: timeBetween,
            bridgeId: transaction.bridgeId
          }
        };
      }

      return null;
    } catch (error) {
      logger.error('Error in duplicate transaction detection:', error);
      return null;
    }
  }

  // Detection Rule: Suspicious Contract
  async detectSuspiciousContract(transaction) {
    try {
      if (!this.rules.suspiciousContract.enabled) return null;

      const blacklist = this.rules.suspiciousContract.blacklist || [];
      
      // Check if any address in the transaction is blacklisted
      const addressesToCheck = [
        transaction.from,
        transaction.to,
        transaction.tokenAddress,
        transaction.bridgeContract
      ].filter(addr => addr && addr !== '0x0000000000000000000000000000000000000000');

      for (const address of addressesToCheck) {
        if (blacklist.includes(address.toLowerCase())) {
          return {
            isAnomaly: true,
            type: 'suspicious_contract',
            severity: 'critical',
            title: 'Suspicious Contract Interaction',
            description: `Transaction involves blacklisted address: ${address}`,
            rule: 'suspicious_contract',
            confidence: 1.0,
            data: {
              contractAddress: address,
              riskScore: 1.0,
              blacklistReason: 'Address found in blacklist'
            }
          };
        }
      }

      // Additional heuristics for suspicious behavior
      const suspiciousPatterns = await this.checkSuspiciousPatterns(transaction);
      if (suspiciousPatterns) {
        return suspiciousPatterns;
      }

      return null;
    } catch (error) {
      logger.error('Error in suspicious contract detection:', error);
      return null;
    }
  }

  // Check for suspicious patterns
  async checkSuspiciousPatterns(transaction) {
    try {
      // Check for rapid successive transactions from same address
      const recentTransactions = await TransactionOperations.getPaginated({
        from: transaction.from,
        startDate: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        limit: 10
      });

      if (recentTransactions.transactions.length > 5) {
        return {
          isAnomaly: true,
          type: 'suspicious_contract',
          severity: 'medium',
          title: 'Rapid Transaction Pattern',
          description: `Address ${transaction.from} has made ${recentTransactions.transactions.length} transactions in the last 5 minutes`,
          rule: 'suspicious_contract',
          confidence: 0.7,
          data: {
            contractAddress: transaction.from,
            riskScore: 0.7,
            blacklistReason: 'Rapid transaction pattern detected'
          }
        };
      }

      return null;
    } catch (error) {
      logger.error('Error checking suspicious patterns:', error);
      return null;
    }
  }

  // Detection Rule: Unusual Volume
  async detectUnusualVolume(transaction) {
    try {
      // Get historical volume data for comparison
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
      
      const volumeStats = await TransactionOperations.getVolumeStats(
        startDate, 
        endDate, 
        transaction.chainId
      );

      if (!volumeStats || volumeStats.length === 0) return null;

      // Find stats for this token
      const chainStats = volumeStats.find(stat => stat._id === transaction.chainId);
      if (!chainStats) return null;

      const tokenStats = chainStats.tokens.find(token => 
        token.address.toLowerCase() === transaction.tokenAddress.toLowerCase()
      );

      if (!tokenStats) return null;

      // Calculate if this transaction is unusually large
      const averageVolume = tokenStats.volume / tokenStats.count;
      const volumeMultiplier = transaction.amountFormatted / averageVolume;

      // Alert if transaction is 10x larger than average
      if (volumeMultiplier > 10) {
        return {
          isAnomaly: true,
          type: 'unusual_volume',
          severity: volumeMultiplier > 50 ? 'critical' : 'high',
          title: 'Unusual Transaction Volume',
          description: `Transaction volume is ${volumeMultiplier.toFixed(1)}x larger than average`,
          rule: 'unusual_volume',
          confidence: 0.8,
          data: {
            volumeAmount: transaction.amount,
            averageVolume: averageVolume.toString(),
            volumeMultiplier: volumeMultiplier,
            timeWindow: '24 hours'
          }
        };
      }

      return null;
    } catch (error) {
      logger.error('Error in unusual volume detection:', error);
      return null;
    }
  }

  // Detection Rule: Failed Verification
  async detectFailedVerification(transaction) {
    try {
      // This would implement cryptographic verification of bridge transactions
      // For now, we'll implement basic checks
      
      // Check if required fields are present
      const requiredFields = ['bridgeId', 'amount', 'tokenAddress'];
      const missingFields = requiredFields.filter(field => !transaction[field]);

      if (missingFields.length > 0) {
        return {
          isAnomaly: true,
          type: 'failed_verification',
          severity: 'high',
          title: 'Transaction Verification Failed',
          description: `Transaction missing required fields: ${missingFields.join(', ')}`,
          rule: 'failed_verification',
          confidence: 0.9,
          data: {
            missingFields: missingFields,
            transactionHash: transaction.txHash
          }
        };
      }

      return null;
    } catch (error) {
      logger.error('Error in failed verification detection:', error);
      return null;
    }
  }

  // Detection Rule: Replay Attack
  async detectReplayAttack(transaction) {
    try {
      // Look for transactions with identical bridgeId across different chains
      if (!transaction.bridgeId) return null;

      const sameIdTransactions = await TransactionOperations.findByBridgeId(transaction.bridgeId);
      
      // Filter out the current transaction and look for suspicious patterns
      const otherTransactions = sameIdTransactions.filter(tx => 
        tx._id.toString() !== transaction._id.toString()
      );

      // Check for same bridgeId used on multiple chains (potential replay)
      const chainIds = new Set(otherTransactions.map(tx => tx.chainId));
      
      if (chainIds.size > 1) {
        return {
          isAnomaly: true,
          type: 'replay_attack',
          severity: 'critical',
          title: 'Potential Replay Attack',
          description: `Bridge ID ${transaction.bridgeId} used across multiple chains`,
          rule: 'replay_attack',
          confidence: 0.9,
          data: {
            bridgeId: transaction.bridgeId,
            affectedChains: Array.from(chainIds),
            transactionCount: otherTransactions.length + 1
          }
        };
      }

      return null;
    } catch (error) {
      logger.error('Error in replay attack detection:', error);
      return null;
    }
  }

  // Detection Rule: Gas Anomaly
  async detectGasAnomaly(transaction) {
    try {
      if (!transaction.gasUsed || !transaction.gasPrice) return null;

      const gasUsed = parseInt(transaction.gasUsed);
      const gasPrice = parseInt(transaction.gasPrice);
      
      // Define normal ranges for different networks
      const gasLimits = {
        1: { maxGasUsed: 500000, maxGasPrice: 100e9 }, // Ethereum
        137: { maxGasUsed: 1000000, maxGasPrice: 50e9 }, // Polygon
        56: { maxGasUsed: 1000000, maxGasPrice: 20e9 } // BSC
      };

      const limits = gasLimits[transaction.chainId];
      if (!limits) return null;

      // Check for unusually high gas usage or price
      if (gasUsed > limits.maxGasUsed || gasPrice > limits.maxGasPrice) {
        return {
          isAnomaly: true,
          type: 'gas_anomaly',
          severity: 'medium',
          title: 'Gas Usage Anomaly',
          description: `Unusual gas usage detected: ${gasUsed} gas at ${gasPrice} wei`,
          rule: 'gas_anomaly',
          confidence: 0.7,
          data: {
            gasUsed: gasUsed,
            gasPrice: gasPrice,
            maxExpectedGasUsed: limits.maxGasUsed,
            maxExpectedGasPrice: limits.maxGasPrice
          }
        };
      }

      return null;
    } catch (error) {
      logger.error('Error in gas anomaly detection:', error);
      return null;
    }
  }

  // Get detection statistics
  getStats() {
    return {
      enabledRules: Array.from(this.detectionHandlers.keys()).filter(rule => this.isRuleEnabled(rule)),
      queueSize: this.processingQueue.length,
      isProcessing: this.isProcessing
    };
  }

  // Update detection rules
  updateRules(newRules) {
    this.rules = { ...this.rules, ...newRules };
    logger.info('Anomaly detection rules updated');
  }
}

module.exports = AnomalyDetector;
