const BaseEventListener = require('./BaseEventListener');
const logger = require('../utils/logger');

class BSCListener extends BaseEventListener {
  constructor(networkConfig, alertSystem) {
    super(networkConfig, alertSystem);
    this.tokenCache = new Map();
    this.validatorCache = new Map(); // Cache for validator information
  }

  async initialize() {
    try {
      await super.initialize();
      await this.initializeTokenCache();
      
      logger.info('BSC listener initialized with enhanced features');
    } catch (error) {
      logger.error('Failed to initialize BSC listener:', error);
      throw error;
    }
  }

  // Initialize cache with common BSC tokens
  async initializeTokenCache() {
    try {
      const commonTokens = [
        {
          address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
          symbol: 'USDC',
          decimals: 18,
          name: 'USD Coin'
        },
        {
          address: '0x55d398326f99059fF775485246999027B3197955',
          symbol: 'USDT',
          decimals: 18,
          name: 'Tether USD'
        },
        {
          address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
          symbol: 'DAI',
          decimals: 18,
          name: 'Dai Token'
        },
        {
          address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
          symbol: 'ETH',
          decimals: 18,
          name: 'Ethereum Token'
        },
        {
          address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
          symbol: 'WBNB',
          decimals: 18,
          name: 'Wrapped BNB'
        }
      ];

      for (const token of commonTokens) {
        this.tokenCache.set(token.address.toLowerCase(), token);
      }

      logger.info(`BSC token cache initialized with ${commonTokens.length} tokens`);
    } catch (error) {
      logger.error('Error initializing BSC token cache:', error);
    }
  }

  // Override to add BSC-specific token metadata fetching
  async normalizeEventData(event, eventType) {
    const normalizedData = await super.normalizeEventData(event, eventType);
    
    // Enhance with token metadata
    if (normalizedData.tokenAddress && normalizedData.tokenAddress !== '0x0000000000000000000000000000000000000000') {
      const tokenInfo = await this.getTokenInfo(normalizedData.tokenAddress);
      
      normalizedData.tokenSymbol = tokenInfo.symbol;
      normalizedData.tokenDecimals = tokenInfo.decimals;
      normalizedData.tokenName = tokenInfo.name;
      
      // Recalculate formatted amount with correct decimals
      normalizedData.amountFormatted = this.formatTokenAmount(
        normalizedData.amount, 
        tokenInfo.decimals
      );
    }

    // Add BSC-specific fields
    normalizedData.networkSpecific = {
      gasPrice: normalizedData.gasPrice,
      gasUsed: normalizedData.gasUsed,
      transactionFee: normalizedData.transactionFee,
      bnbPrice: await this.getBNBPrice(), // In production, fetch from price API
      validatorInfo: await this.getValidatorInfo(event.blockNumber)
    };

    return normalizedData;
  }

  // Get token information (similar to other networks but with BSC-specific handling)
  async getTokenInfo(tokenAddress) {
    const address = tokenAddress.toLowerCase();
    
    if (this.tokenCache.has(address)) {
      return this.tokenCache.get(address);
    }

    try {
      const tokenABI = [
        {
          "constant": true,
          "inputs": [],
          "name": "symbol",
          "outputs": [{"name": "", "type": "string"}],
          "type": "function"
        },
        {
          "constant": true,
          "inputs": [],
          "name": "decimals",
          "outputs": [{"name": "", "type": "uint8"}],
          "type": "function"
        },
        {
          "constant": true,
          "inputs": [],
          "name": "name",
          "outputs": [{"name": "", "type": "string"}],
          "type": "function"
        }
      ];

      const tokenContract = new this.web3.eth.Contract(tokenABI, tokenAddress);
      
      const [symbol, decimals, name] = await Promise.all([
        tokenContract.methods.symbol().call().catch(() => 'UNKNOWN'),
        tokenContract.methods.decimals().call().catch(() => 18),
        tokenContract.methods.name().call().catch(() => 'Unknown Token')
      ]);

      const tokenInfo = {
        address: tokenAddress,
        symbol: symbol,
        decimals: parseInt(decimals),
        name: name
      };

      this.tokenCache.set(address, tokenInfo);
      
      logger.debug(`Fetched BSC token info for ${tokenAddress}: ${symbol}`);
      return tokenInfo;
    } catch (error) {
      logger.error(`Error fetching BSC token info for ${tokenAddress}:`, error);
      
      const defaultInfo = {
        address: tokenAddress,
        symbol: 'UNKNOWN',
        decimals: 18,
        name: 'Unknown Token'
      };
      
      this.tokenCache.set(address, defaultInfo);
      return defaultInfo;
    }
  }

  // Format token amount based on decimals
  formatTokenAmount(amount, decimals) {
    try {
      const divisor = BigInt(10) ** BigInt(decimals);
      const amountBigInt = BigInt(amount);
      const wholePart = amountBigInt / divisor;
      const fractionalPart = amountBigInt % divisor;
      
      return parseFloat(`${wholePart}.${fractionalPart.toString().padStart(decimals, '0')}`);
    } catch (error) {
      logger.error('Error formatting token amount:', error);
      return 0;
    }
  }

  // Get BNB price (placeholder - in production, use price API)
  async getBNBPrice() {
    try {
      // In production, fetch from CoinGecko, CoinMarketCap, or similar
      return 310; // Placeholder BNB price in USD
    } catch (error) {
      logger.error('Error fetching BNB price:', error);
      return 0;
    }
  }

  // Get validator information for a block (BSC-specific)
  async getValidatorInfo(blockNumber) {
    try {
      if (this.validatorCache.has(blockNumber)) {
        return this.validatorCache.get(blockNumber);
      }

      const block = await this.web3.eth.getBlock(blockNumber);
      const validatorInfo = {
        miner: block.miner,
        timestamp: block.timestamp,
        gasLimit: block.gasLimit,
        gasUsed: block.gasUsed
      };

      this.validatorCache.set(blockNumber, validatorInfo);
      
      // Keep cache size manageable
      if (this.validatorCache.size > 1000) {
        const firstKey = this.validatorCache.keys().next().value;
        this.validatorCache.delete(firstKey);
      }

      return validatorInfo;
    } catch (error) {
      logger.error('Error getting validator info:', error);
      return null;
    }
  }

  // Override to add BSC-specific event handling
  async handleEvent(event, eventType) {
    try {
      await super.handleEvent(event, eventType);
      await this.processBSCSpecificLogic(event, eventType);
    } catch (error) {
      logger.error(`Error in BSC-specific event handling:`, error);
    }
  }

  // BSC-specific event processing
  async processBSCSpecificLogic(event, eventType) {
    try {
      // Check for high-value transactions
      const { returnValues } = event;
      if (returnValues.amount) {
        const tokenInfo = await this.getTokenInfo(returnValues.token);
        const formattedAmount = this.formatTokenAmount(returnValues.amount, tokenInfo.decimals);
        
        if (this.isHighValueTransaction(formattedAmount, tokenInfo.symbol)) {
          await this.alertSystem.sendAlert({
            type: 'high_volume',
            severity: 'warning',
            title: 'High Value BSC Bridge Transaction',
            message: `Large ${eventType} transaction detected: ${formattedAmount} ${tokenInfo.symbol}`,
            chainId: this.networkConfig.chainId,
            networkName: 'bsc',
            details: {
              amount: formattedAmount,
              token: tokenInfo.symbol,
              transactionHash: event.transactionHash,
              eventType: eventType,
              validator: (await this.getValidatorInfo(event.blockNumber))?.miner
            }
          });
        }
      }

      // Check for unusual block times (BSC has ~3 second block times)
      await this.checkBlockTimeAnomaly(event);
      
      // Monitor validator behavior
      await this.monitorValidatorBehavior(event);
    } catch (error) {
      logger.error('Error in BSC-specific processing:', error);
    }
  }

  // Check if transaction is high value (BSC-specific thresholds)
  isHighValueTransaction(amount, symbol) {
    const highValueThresholds = {
      'USDC': 75000, // BSC has good liquidity
      'USDT': 75000,
      'DAI': 75000,
      'ETH': 30,
      'WBNB': 300,
      'BNB': 300
    };

    const threshold = highValueThresholds[symbol] || 750000;
    return amount >= threshold;
  }

  // Check for unusual block times
  async checkBlockTimeAnomaly(event) {
    try {
      const currentBlock = await this.web3.eth.getBlock(event.blockNumber);
      const previousBlock = await this.web3.eth.getBlock(event.blockNumber - 1);
      
      const blockTime = currentBlock.timestamp - previousBlock.timestamp;
      
      // Alert if block time is unusually long (>10 seconds for BSC)
      if (blockTime > 10) {
        await this.alertSystem.sendAlert({
          type: 'network_issue',
          severity: 'warning',
          title: 'Unusual Block Time on BSC',
          message: `Block time anomaly detected: ${blockTime} seconds between blocks`,
          chainId: this.networkConfig.chainId,
          networkName: 'bsc',
          details: {
            blockNumber: event.blockNumber,
            blockTime: blockTime,
            currentBlockTimestamp: currentBlock.timestamp,
            previousBlockTimestamp: previousBlock.timestamp
          }
        });
      }
    } catch (error) {
      logger.error('Error checking block time anomaly:', error);
    }
  }

  // Monitor validator behavior for anomalies
  async monitorValidatorBehavior(event) {
    try {
      const validatorInfo = await this.getValidatorInfo(event.blockNumber);
      if (!validatorInfo) return;

      // Check for unusual gas usage patterns
      const gasUtilization = (validatorInfo.gasUsed / validatorInfo.gasLimit) * 100;
      
      if (gasUtilization > 95) {
        await this.alertSystem.sendAlert({
          type: 'network_issue',
          severity: 'warning',
          title: 'High Gas Utilization on BSC',
          message: `Block with very high gas utilization: ${gasUtilization.toFixed(2)}%`,
          chainId: this.networkConfig.chainId,
          networkName: 'bsc',
          details: {
            blockNumber: event.blockNumber,
            validator: validatorInfo.miner,
            gasUtilization: gasUtilization,
            gasUsed: validatorInfo.gasUsed,
            gasLimit: validatorInfo.gasLimit
          }
        });
      }
    } catch (error) {
      logger.error('Error monitoring validator behavior:', error);
    }
  }

  // Get BSC-specific network statistics
  async getNetworkStats() {
    try {
      const [blockNumber, gasPrice, balance, bnbPrice] = await Promise.all([
        this.web3.eth.getBlockNumber(),
        this.web3.eth.getGasPrice(),
        this.web3.eth.getBalance(this.networkConfig.bridgeContract),
        this.getBNBPrice()
      ]);

      return {
        currentBlock: blockNumber,
        gasPrice: this.web3.utils.fromWei(gasPrice, 'gwei'),
        bridgeBalance: this.web3.utils.fromWei(balance, 'ether'),
        bnbPrice: bnbPrice,
        tokenCacheSize: this.tokenCache.size,
        validatorCacheSize: this.validatorCache.size
      };
    } catch (error) {
      logger.error('Error getting BSC network stats:', error);
      return null;
    }
  }
}

module.exports = BSCListener;
