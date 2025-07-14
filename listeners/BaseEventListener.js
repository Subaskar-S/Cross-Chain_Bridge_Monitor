const { Web3 } = require('web3');
const logger = require('../utils/logger');
const { TransactionOperations } = require('../db/operations');

class BaseEventListener {
  constructor(networkConfig, alertSystem) {
    this.networkConfig = networkConfig;
    this.alertSystem = alertSystem;
    this.web3 = null;
    this.wsProvider = null;
    this.contract = null;
    this.isListening = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000; // 5 seconds
    this.lastProcessedBlock = null;
    this.eventSubscriptions = new Map();
  }

  // Initialize the Web3 connection and contract
  async initialize() {
    try {
      // Initialize WebSocket provider for real-time events
      this.wsProvider = new Web3.providers.WebsocketProvider(
        this.networkConfig.wsUrl,
        {
          reconnect: {
            auto: true,
            delay: this.reconnectDelay,
            maxAttempts: this.maxReconnectAttempts,
            onTimeout: false
          }
        }
      );

      this.web3 = new Web3(this.wsProvider);

      // Set up provider event handlers
      this.setupProviderEventHandlers();

      // Initialize contract if bridge contract address is provided
      if (this.networkConfig.bridgeContract) {
        await this.initializeContract();
      }

      logger.info(`${this.networkConfig.name} event listener initialized`);
      return true;
    } catch (error) {
      logger.error(`Failed to initialize ${this.networkConfig.name} event listener:`, error);
      throw error;
    }
  }

  // Initialize the bridge contract
  async initializeContract() {
    try {
      // Basic ERC20 Bridge ABI - should be replaced with actual bridge contract ABI
      const bridgeABI = [
        {
          "anonymous": false,
          "inputs": [
            {"indexed": true, "name": "from", "type": "address"},
            {"indexed": true, "name": "to", "type": "address"},
            {"indexed": false, "name": "amount", "type": "uint256"},
            {"indexed": false, "name": "token", "type": "address"},
            {"indexed": false, "name": "targetChain", "type": "uint256"},
            {"indexed": false, "name": "bridgeId", "type": "bytes32"}
          ],
          "name": "Lock",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {"indexed": true, "name": "to", "type": "address"},
            {"indexed": false, "name": "amount", "type": "uint256"},
            {"indexed": false, "name": "token", "type": "address"},
            {"indexed": false, "name": "sourceChain", "type": "uint256"},
            {"indexed": false, "name": "bridgeId", "type": "bytes32"}
          ],
          "name": "Unlock",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {"indexed": true, "name": "to", "type": "address"},
            {"indexed": false, "name": "amount", "type": "uint256"},
            {"indexed": false, "name": "token", "type": "address"},
            {"indexed": false, "name": "sourceChain", "type": "uint256"},
            {"indexed": false, "name": "bridgeId", "type": "bytes32"}
          ],
          "name": "Mint",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {"indexed": true, "name": "from", "type": "address"},
            {"indexed": false, "name": "amount", "type": "uint256"},
            {"indexed": false, "name": "token", "type": "address"},
            {"indexed": false, "name": "targetChain", "type": "uint256"},
            {"indexed": false, "name": "bridgeId", "type": "bytes32"}
          ],
          "name": "Burn",
          "type": "event"
        }
      ];

      this.contract = new this.web3.eth.Contract(bridgeABI, this.networkConfig.bridgeContract);
      logger.info(`${this.networkConfig.name} bridge contract initialized: ${this.networkConfig.bridgeContract}`);
    } catch (error) {
      logger.error(`Failed to initialize bridge contract for ${this.networkConfig.name}:`, error);
      throw error;
    }
  }

  // Set up WebSocket provider event handlers
  setupProviderEventHandlers() {
    this.wsProvider.on('connect', () => {
      logger.info(`${this.networkConfig.name} WebSocket connected`);
      this.reconnectAttempts = 0;
    });

    this.wsProvider.on('disconnect', (error) => {
      logger.warn(`${this.networkConfig.name} WebSocket disconnected:`, error);
      this.isListening = false;
    });

    this.wsProvider.on('error', (error) => {
      logger.error(`${this.networkConfig.name} WebSocket error:`, error);
      this.handleConnectionError(error);
    });
  }

  // Handle connection errors and implement reconnection logic
  async handleConnectionError(error) {
    this.isListening = false;
    this.reconnectAttempts++;

    if (this.reconnectAttempts <= this.maxReconnectAttempts) {
      logger.info(`Attempting to reconnect to ${this.networkConfig.name} (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(async () => {
        try {
          await this.initialize();
          await this.startListening();
        } catch (reconnectError) {
          logger.error(`Reconnection failed for ${this.networkConfig.name}:`, reconnectError);
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      logger.error(`Max reconnection attempts reached for ${this.networkConfig.name}`);
      await this.alertSystem.sendAlert({
        type: 'network_issue',
        severity: 'critical',
        title: `${this.networkConfig.name} Connection Failed`,
        message: `Failed to maintain connection to ${this.networkConfig.name} after ${this.maxReconnectAttempts} attempts`,
        chainId: this.networkConfig.chainId,
        networkName: this.networkConfig.name.toLowerCase()
      });
    }
  }

  // Start listening for events
  async startListening() {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      this.isListening = true;
      
      // Subscribe to bridge events
      await this.subscribeToEvent('Lock');
      await this.subscribeToEvent('Unlock');
      await this.subscribeToEvent('Mint');
      await this.subscribeToEvent('Burn');

      // Start processing historical events if needed
      await this.processHistoricalEvents();

      logger.info(`${this.networkConfig.name} event listener started`);
    } catch (error) {
      logger.error(`Failed to start listening on ${this.networkConfig.name}:`, error);
      throw error;
    }
  }

  // Subscribe to a specific event
  async subscribeToEvent(eventName) {
    try {
      const subscription = this.contract.events[eventName]()
        .on('data', (event) => this.handleEvent(event, eventName))
        .on('error', (error) => {
          logger.error(`${this.networkConfig.name} ${eventName} event error:`, error);
        });

      this.eventSubscriptions.set(eventName, subscription);
      logger.info(`Subscribed to ${eventName} events on ${this.networkConfig.name}`);
    } catch (error) {
      logger.error(`Failed to subscribe to ${eventName} on ${this.networkConfig.name}:`, error);
      throw error;
    }
  }

  // Handle incoming events
  async handleEvent(event, eventType) {
    try {
      logger.debug(`${this.networkConfig.name} ${eventType} event received:`, event.transactionHash);

      // Normalize event data
      const normalizedEvent = await this.normalizeEventData(event, eventType);
      
      // Store in database
      const transaction = await TransactionOperations.create(normalizedEvent);
      
      if (transaction) {
        // Emit real-time update
        this.alertSystem.emitRealTimeUpdate('transaction', transaction);
        
        // Check for anomalies
        await this.alertSystem.checkForAnomalies(transaction);
      }

      this.lastProcessedBlock = event.blockNumber;
    } catch (error) {
      logger.error(`Error handling ${eventType} event on ${this.networkConfig.name}:`, error);
    }
  }

  // Normalize event data to standard format
  async normalizeEventData(event, eventType) {
    const { returnValues, transactionHash, blockNumber, blockHash, transactionIndex, logIndex } = event;
    
    // Get additional transaction details
    const [transaction, receipt, block] = await Promise.all([
      this.web3.eth.getTransaction(transactionHash),
      this.web3.eth.getTransactionReceipt(transactionHash),
      this.web3.eth.getBlock(blockNumber)
    ]);

    // Determine target chain based on event data
    let targetChainId = null;
    let targetNetworkName = null;
    
    if (returnValues.targetChain) {
      targetChainId = parseInt(returnValues.targetChain);
      targetNetworkName = this.getNetworkNameFromChainId(targetChainId);
    } else if (returnValues.sourceChain) {
      // For Unlock/Mint events, the source chain is where the Lock/Burn happened
      targetChainId = this.networkConfig.chainId; // Current chain is the target
      targetNetworkName = this.networkConfig.name.toLowerCase();
    }

    return {
      txHash: transactionHash,
      blockNumber: blockNumber,
      blockHash: blockHash,
      transactionIndex: transactionIndex,
      logIndex: logIndex,
      chainId: this.networkConfig.chainId,
      networkName: this.networkConfig.name.toLowerCase(),
      eventType: eventType,
      bridgeContract: this.networkConfig.bridgeContract,
      tokenAddress: returnValues.token || '0x0000000000000000000000000000000000000000',
      tokenSymbol: 'UNKNOWN', // Should be fetched from token contract
      tokenDecimals: 18, // Should be fetched from token contract
      amount: returnValues.amount || '0',
      amountFormatted: parseFloat(this.web3.utils.fromWei(returnValues.amount || '0', 'ether')),
      from: returnValues.from || transaction.from,
      to: returnValues.to || transaction.to,
      recipient: returnValues.to,
      targetChainId: targetChainId,
      targetNetworkName: targetNetworkName,
      bridgeId: returnValues.bridgeId,
      nonce: returnValues.nonce,
      status: 'pending',
      timestamp: new Date(parseInt(block.timestamp) * 1000),
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: transaction.gasPrice.toString(),
      transactionFee: (BigInt(receipt.gasUsed) * BigInt(transaction.gasPrice)).toString(),
      rawEventData: event
    };
  }

  // Get network name from chain ID
  getNetworkNameFromChainId(chainId) {
    const chainMap = {
      1: 'ethereum',
      137: 'polygon',
      56: 'bsc'
    };
    return chainMap[chainId] || 'unknown';
  }

  // Process historical events (for initial sync)
  async processHistoricalEvents() {
    try {
      const startBlock = this.networkConfig.startBlock === 'latest' 
        ? await this.web3.eth.getBlockNumber() 
        : parseInt(this.networkConfig.startBlock);

      const currentBlock = await this.web3.eth.getBlockNumber();
      
      if (startBlock >= currentBlock) {
        logger.info(`${this.networkConfig.name} is up to date, no historical events to process`);
        return;
      }

      logger.info(`Processing historical events for ${this.networkConfig.name} from block ${startBlock} to ${currentBlock}`);

      // Process in batches to avoid overwhelming the RPC
      const batchSize = 1000;
      for (let fromBlock = startBlock; fromBlock < currentBlock; fromBlock += batchSize) {
        const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);
        await this.processEventBatch(fromBlock, toBlock);
      }

      logger.info(`Historical event processing completed for ${this.networkConfig.name}`);
    } catch (error) {
      logger.error(`Error processing historical events for ${this.networkConfig.name}:`, error);
    }
  }

  // Process a batch of historical events
  async processEventBatch(fromBlock, toBlock) {
    try {
      const events = await this.contract.getPastEvents('allEvents', {
        fromBlock,
        toBlock
      });

      for (const event of events) {
        await this.handleEvent(event, event.event);
      }

      logger.debug(`Processed ${events.length} events from blocks ${fromBlock}-${toBlock} on ${this.networkConfig.name}`);
    } catch (error) {
      logger.error(`Error processing event batch ${fromBlock}-${toBlock} on ${this.networkConfig.name}:`, error);
    }
  }

  // Stop listening and clean up
  async stopListening() {
    try {
      this.isListening = false;
      
      // Unsubscribe from all events
      for (const [eventName, subscription] of this.eventSubscriptions) {
        subscription.unsubscribe();
        logger.info(`Unsubscribed from ${eventName} events on ${this.networkConfig.name}`);
      }
      
      this.eventSubscriptions.clear();
      
      // Close WebSocket connection
      if (this.wsProvider) {
        this.wsProvider.disconnect();
      }

      logger.info(`${this.networkConfig.name} event listener stopped`);
    } catch (error) {
      logger.error(`Error stopping ${this.networkConfig.name} event listener:`, error);
    }
  }

  // Get listener status
  getStatus() {
    return {
      networkName: this.networkConfig.name,
      chainId: this.networkConfig.chainId,
      isListening: this.isListening,
      lastProcessedBlock: this.lastProcessedBlock,
      reconnectAttempts: this.reconnectAttempts,
      activeSubscriptions: Array.from(this.eventSubscriptions.keys())
    };
  }
}

module.exports = BaseEventListener;
