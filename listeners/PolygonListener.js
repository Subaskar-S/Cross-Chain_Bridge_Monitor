const BaseEventListener = require('./BaseEventListener');
const logger = require('../utils/logger');

class PolygonListener extends BaseEventListener {
  constructor(networkConfig, alertSystem) {
    super(networkConfig, alertSystem);
    this.tokenCache = new Map();
    this.checkpointCache = new Map(); // Cache for checkpoint data
  }

  async initialize() {
    try {
      await super.initialize();
      await this.initializeTokenCache();
      
      logger.info('Polygon listener initialized with enhanced features');
    } catch (error) {
      logger.error('Failed to initialize Polygon listener:', error);
      throw error;
    }
  }

  // Initialize cache with common Polygon tokens
  async initializeTokenCache() {
    try {
      const commonTokens = [
        {
          address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
          symbol: 'USDC',
          decimals: 6,
          name: 'USD Coin (PoS)'
        },
        {
          address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
          symbol: 'USDT',
          decimals: 6,
          name: 'Tether USD (PoS)'
        },
        {
          address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
          symbol: 'DAI',
          decimals: 18,
          name: 'Dai Stablecoin (PoS)'
        },
        {
          address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
          symbol: 'WETH',
          decimals: 18,
          name: 'Wrapped Ether'
        }
      ];

      for (const token of commonTokens) {
        this.tokenCache.set(token.address.toLowerCase(), token);
      }

      logger.info(`Polygon token cache initialized with ${commonTokens.length} tokens`);
    } catch (error) {
      logger.error('Error initializing Polygon token cache:', error);
    }
  }

  // Override to add Polygon-specific token metadata fetching
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

    // Add Polygon-specific fields
    normalizedData.networkSpecific = {
      gasPrice: normalizedData.gasPrice,
      gasUsed: normalizedData.gasUsed,
      transactionFee: normalizedData.transactionFee,
      maticPrice: await this.getMaticPrice(), // In production, fetch from price API
      isCheckpointed: await this.isTransactionCheckpointed(event.transactionHash)
    };

    return normalizedData;
  }

  // Get token information (similar to Ethereum but with Polygon-specific handling)
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
      
      logger.debug(`Fetched Polygon token info for ${tokenAddress}: ${symbol}`);
      return tokenInfo;
    } catch (error) {
      logger.error(`Error fetching Polygon token info for ${tokenAddress}:`, error);
      
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

  // Check if transaction is checkpointed (Polygon-specific)
  async isTransactionCheckpointed(txHash) {
    try {
      // In production, this would check against Polygon's checkpoint system
      // For now, return a placeholder
      if (this.checkpointCache.has(txHash)) {
        return this.checkpointCache.get(txHash);
      }

      // Simulate checkpoint check - in reality, this would query Polygon's checkpoint API
      const isCheckpointed = Math.random() > 0.3; // 70% chance of being checkpointed
      this.checkpointCache.set(txHash, isCheckpointed);
      
      return isCheckpointed;
    } catch (error) {
      logger.error('Error checking checkpoint status:', error);
      return false;
    }
  }

  // Get MATIC price (placeholder - in production, use price API)
  async getMaticPrice() {
    try {
      // In production, fetch from CoinGecko, CoinMarketCap, or similar
      return 0.85; // Placeholder MATIC price in USD
    } catch (error) {
      logger.error('Error fetching MATIC price:', error);
      return 0;
    }
  }

  // Override to add Polygon-specific event handling
  async handleEvent(event, eventType) {
    try {
      await super.handleEvent(event, eventType);
      await this.processPolygonSpecificLogic(event, eventType);
    } catch (error) {
      logger.error(`Error in Polygon-specific event handling:`, error);
    }
  }

  // Polygon-specific event processing
  async processPolygonSpecificLogic(event, eventType) {
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
            title: 'High Value Polygon Bridge Transaction',
            message: `Large ${eventType} transaction detected: ${formattedAmount} ${tokenInfo.symbol}`,
            chainId: this.networkConfig.chainId,
            networkName: 'polygon',
            details: {
              amount: formattedAmount,
              token: tokenInfo.symbol,
              transactionHash: event.transactionHash,
              eventType: eventType,
              isCheckpointed: await this.isTransactionCheckpointed(event.transactionHash)
            }
          });
        }
      }

      // Check for low gas price anomalies (Polygon has very low fees)
      await this.checkLowGasAnomaly(event);
      
      // Check checkpoint status for cross-chain verification
      await this.monitorCheckpointStatus(event);
    } catch (error) {
      logger.error('Error in Polygon-specific processing:', error);
    }
  }

  // Check if transaction is high value (Polygon-specific thresholds)
  isHighValueTransaction(amount, symbol) {
    const highValueThresholds = {
      'USDC': 50000, // Lower threshold due to higher volume on Polygon
      'USDT': 50000,
      'DAI': 50000,
      'WETH': 25,
      'MATIC': 100000
    };

    const threshold = highValueThresholds[symbol] || 500000;
    return amount >= threshold;
  }

  // Check for unusually low gas prices (might indicate network issues)
  async checkLowGasAnomaly(event) {
    try {
      const gasPrice = parseInt(event.gasPrice);
      const gasPriceGwei = this.web3.utils.fromWei(gasPrice.toString(), 'gwei');
      
      // Alert if gas price is unusually low (might indicate network issues)
      if (parseFloat(gasPriceGwei) < 1) { // Less than 1 Gwei
        await this.alertSystem.sendAlert({
          type: 'gas_anomaly',
          severity: 'info',
          title: 'Unusually Low Gas Price on Polygon',
          message: `Transaction with very low gas price detected: ${gasPriceGwei} Gwei`,
          chainId: this.networkConfig.chainId,
          networkName: 'polygon',
          details: {
            transactionHash: event.transactionHash,
            gasPrice: gasPriceGwei,
            gasUsed: event.gasUsed
          }
        });
      }
    } catch (error) {
      logger.error('Error checking gas anomaly:', error);
    }
  }

  // Monitor checkpoint status for important transactions
  async monitorCheckpointStatus(event) {
    try {
      const { returnValues } = event;
      
      // Only monitor high-value or cross-chain transactions
      if (returnValues.amount && returnValues.targetChain) {
        const tokenInfo = await this.getTokenInfo(returnValues.token);
        const formattedAmount = this.formatTokenAmount(returnValues.amount, tokenInfo.decimals);
        
        if (formattedAmount > 10000) { // Monitor transactions > $10k equivalent
          const isCheckpointed = await this.isTransactionCheckpointed(event.transactionHash);
          
          if (!isCheckpointed) {
            // Schedule a delayed check for checkpoint status
            setTimeout(async () => {
              const recheckStatus = await this.isTransactionCheckpointed(event.transactionHash);
              if (!recheckStatus) {
                await this.alertSystem.sendAlert({
                  type: 'bridge_timeout',
                  severity: 'warning',
                  title: 'Polygon Transaction Not Checkpointed',
                  message: `High-value transaction not checkpointed after delay: ${event.transactionHash}`,
                  chainId: this.networkConfig.chainId,
                  networkName: 'polygon',
                  details: {
                    transactionHash: event.transactionHash,
                    amount: formattedAmount,
                    token: tokenInfo.symbol,
                    targetChain: returnValues.targetChain
                  }
                });
              }
            }, 10 * 60 * 1000); // Check again after 10 minutes
          }
        }
      }
    } catch (error) {
      logger.error('Error monitoring checkpoint status:', error);
    }
  }

  // Get Polygon-specific network statistics
  async getNetworkStats() {
    try {
      const [blockNumber, gasPrice, balance, maticPrice] = await Promise.all([
        this.web3.eth.getBlockNumber(),
        this.web3.eth.getGasPrice(),
        this.web3.eth.getBalance(this.networkConfig.bridgeContract),
        this.getMaticPrice()
      ]);

      return {
        currentBlock: blockNumber,
        gasPrice: this.web3.utils.fromWei(gasPrice, 'gwei'),
        bridgeBalance: this.web3.utils.fromWei(balance, 'ether'),
        maticPrice: maticPrice,
        tokenCacheSize: this.tokenCache.size,
        checkpointCacheSize: this.checkpointCache.size
      };
    } catch (error) {
      logger.error('Error getting Polygon network stats:', error);
      return null;
    }
  }
}

module.exports = PolygonListener;
