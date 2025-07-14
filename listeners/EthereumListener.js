const BaseEventListener = require('./BaseEventListener');
const logger = require('../utils/logger');

class EthereumListener extends BaseEventListener {
  constructor(networkConfig, alertSystem) {
    super(networkConfig, alertSystem);
    this.tokenCache = new Map(); // Cache for token metadata
  }

  // Override to add Ethereum-specific initialization
  async initialize() {
    try {
      await super.initialize();
      
      // Initialize token metadata cache
      await this.initializeTokenCache();
      
      logger.info('Ethereum listener initialized with enhanced features');
    } catch (error) {
      logger.error('Failed to initialize Ethereum listener:', error);
      throw error;
    }
  }

  // Initialize cache with common Ethereum tokens
  async initializeTokenCache() {
    try {
      // Common Ethereum tokens - in production, this would be loaded from a database or API
      const commonTokens = [
        {
          address: '0xA0b86a33E6441b8435b662f0E2d0B8A0E4B5B8B0',
          symbol: 'USDC',
          decimals: 6,
          name: 'USD Coin'
        },
        {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          symbol: 'USDT',
          decimals: 6,
          name: 'Tether USD'
        },
        {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          symbol: 'DAI',
          decimals: 18,
          name: 'Dai Stablecoin'
        }
      ];

      for (const token of commonTokens) {
        this.tokenCache.set(token.address.toLowerCase(), token);
      }

      logger.info(`Ethereum token cache initialized with ${commonTokens.length} tokens`);
    } catch (error) {
      logger.error('Error initializing Ethereum token cache:', error);
    }
  }

  // Override to add Ethereum-specific token metadata fetching
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

    // Add Ethereum-specific fields
    normalizedData.networkSpecific = {
      gasPrice: normalizedData.gasPrice,
      gasUsed: normalizedData.gasUsed,
      transactionFee: normalizedData.transactionFee,
      isEIP1559: this.isEIP1559Transaction(event)
    };

    return normalizedData;
  }

  // Get token information (with caching)
  async getTokenInfo(tokenAddress) {
    const address = tokenAddress.toLowerCase();
    
    // Check cache first
    if (this.tokenCache.has(address)) {
      return this.tokenCache.get(address);
    }

    try {
      // ERC20 token ABI for metadata
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

      // Cache the result
      this.tokenCache.set(address, tokenInfo);
      
      logger.debug(`Fetched token info for ${tokenAddress}: ${symbol}`);
      return tokenInfo;
    } catch (error) {
      logger.error(`Error fetching token info for ${tokenAddress}:`, error);
      
      // Return default values
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

  // Check if transaction uses EIP-1559
  isEIP1559Transaction(event) {
    try {
      // EIP-1559 transactions have maxFeePerGas and maxPriorityFeePerGas
      return event.transaction && 
             event.transaction.maxFeePerGas !== undefined && 
             event.transaction.maxPriorityFeePerGas !== undefined;
    } catch (error) {
      return false;
    }
  }

  // Override to add Ethereum-specific event handling
  async handleEvent(event, eventType) {
    try {
      // Call parent handler
      await super.handleEvent(event, eventType);
      
      // Add Ethereum-specific processing
      await this.processEthereumSpecificLogic(event, eventType);
    } catch (error) {
      logger.error(`Error in Ethereum-specific event handling:`, error);
    }
  }

  // Ethereum-specific event processing
  async processEthereumSpecificLogic(event, eventType) {
    try {
      // Check for high-value transactions
      const { returnValues } = event;
      if (returnValues.amount) {
        const tokenInfo = await this.getTokenInfo(returnValues.token);
        const formattedAmount = this.formatTokenAmount(returnValues.amount, tokenInfo.decimals);
        
        // Alert for high-value transactions (>$100k equivalent)
        if (this.isHighValueTransaction(formattedAmount, tokenInfo.symbol)) {
          await this.alertSystem.sendAlert({
            type: 'high_volume',
            severity: 'warning',
            title: 'High Value Ethereum Bridge Transaction',
            message: `Large ${eventType} transaction detected: ${formattedAmount} ${tokenInfo.symbol}`,
            chainId: this.networkConfig.chainId,
            networkName: 'ethereum',
            details: {
              amount: formattedAmount,
              token: tokenInfo.symbol,
              transactionHash: event.transactionHash,
              eventType: eventType
            }
          });
        }
      }

      // Check for unusual gas usage
      if (event.gasUsed) {
        await this.checkGasUsage(event);
      }
    } catch (error) {
      logger.error('Error in Ethereum-specific processing:', error);
    }
  }

  // Check if transaction is high value
  isHighValueTransaction(amount, symbol) {
    // Simple heuristic - in production, this would use real-time price feeds
    const highValueThresholds = {
      'USDC': 100000,
      'USDT': 100000,
      'DAI': 100000,
      'ETH': 50, // ~$100k at $2000/ETH
      'WETH': 50
    };

    const threshold = highValueThresholds[symbol] || 1000000; // Default high threshold
    return amount >= threshold;
  }

  // Check for unusual gas usage
  async checkGasUsage(event) {
    try {
      const gasUsed = parseInt(event.gasUsed);
      const gasPrice = parseInt(event.gasPrice);
      const totalGasCost = gasUsed * gasPrice;

      // Alert for unusually high gas costs (>0.1 ETH)
      const highGasThreshold = this.web3.utils.toWei('0.1', 'ether');
      
      if (totalGasCost > parseInt(highGasThreshold)) {
        await this.alertSystem.sendAlert({
          type: 'gas_anomaly',
          severity: 'warning',
          title: 'High Gas Cost Transaction',
          message: `Transaction with unusually high gas cost detected: ${this.web3.utils.fromWei(totalGasCost.toString(), 'ether')} ETH`,
          chainId: this.networkConfig.chainId,
          networkName: 'ethereum',
          details: {
            transactionHash: event.transactionHash,
            gasUsed: gasUsed,
            gasPrice: gasPrice,
            totalCostETH: this.web3.utils.fromWei(totalGasCost.toString(), 'ether')
          }
        });
      }
    } catch (error) {
      logger.error('Error checking gas usage:', error);
    }
  }

  // Get Ethereum-specific network statistics
  async getNetworkStats() {
    try {
      const [blockNumber, gasPrice, balance] = await Promise.all([
        this.web3.eth.getBlockNumber(),
        this.web3.eth.getGasPrice(),
        this.web3.eth.getBalance(this.networkConfig.bridgeContract)
      ]);

      return {
        currentBlock: blockNumber,
        gasPrice: this.web3.utils.fromWei(gasPrice, 'gwei'),
        bridgeBalance: this.web3.utils.fromWei(balance, 'ether'),
        tokenCacheSize: this.tokenCache.size
      };
    } catch (error) {
      logger.error('Error getting Ethereum network stats:', error);
      return null;
    }
  }
}

module.exports = EthereumListener;
