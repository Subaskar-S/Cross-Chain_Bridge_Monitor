# 🌉 Cross-Chain Bridge Monitoring System

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4.4+-green.svg)](https://mongodb.com/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A comprehensive, production-ready monitoring system for cross-chain bridge transactions with real-time anomaly detection, multi-channel alerting, and an interactive dashboard.

## 🎯 Features

- **Real-time Event Monitoring**: Track bridge events across multiple blockchain networks
- **Anomaly Detection**: Detect timeouts, value mismatches, duplicate transactions, and suspicious activity
- **Real-time Alerts**: Instant notifications via web UI, Discord, Slack, and email
- **Interactive Dashboard**: Visualize bridge flows, volume trends, and system health
- **Historical Analysis**: Query and analyze past bridge transactions
- **RESTful API**: Comprehensive API for integration with external systems

## 🏗️ Architecture

```
├── listeners/          # Blockchain event listeners
├── alerts/            # Anomaly detection and alert system
├── api/               # Express API routes
├── db/                # Database schemas and connection
├── dashboard/         # React frontend dashboard
├── scripts/           # Utility scripts
├── tests/             # Unit and integration tests
├── config/            # Configuration files
└── utils/             # Shared utilities
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB
- Blockchain RPC endpoints (Infura, Alchemy, etc.)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration:
   - MongoDB connection string
   - Blockchain RPC URLs
   - Bridge contract addresses
   - Alert webhook URLs

5. Start the development server:
   ```bash
   npm run dev
   ```

### Production Deployment

```bash
npm start
```

## 📊 API Endpoints

- `GET /api/transactions` - List bridge transactions
- `GET /api/anomalies` - List detected anomalies
- `GET /api/alerts` - List system alerts
- `GET /api/volume` - Get volume statistics
- `GET /api/health` - System health check

## 🔧 Configuration

The system is configured through environment variables and the `config/default.js` file. Key configuration areas:

- **Networks**: RPC URLs, contract addresses, start blocks
- **Alerts**: Timeout windows, webhook URLs, email settings
- **Anomaly Rules**: Detection thresholds and rules
- **Database**: MongoDB connection settings

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## 📝 Scripts

- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm run sync` - Sync historical bridge data
- `npm run health` - Run health check
- `npm run hardhat` - Start local Hardhat node for testing

## 🚨 Monitoring & Alerts

The system monitors for various anomalies:

- **Bridge Timeouts**: Transactions locked but not released within timeout window
- **Value Mismatches**: Discrepancies between locked and minted amounts
- **Duplicate Transactions**: Potential replay attacks
- **Suspicious Contracts**: Interactions with blacklisted addresses

## 🔒 Security Considerations

- All RPC endpoints should use HTTPS/WSS
- Webhook URLs should be kept secure
- Regular monitoring of alert rules and thresholds
- Database access should be restricted

## 📈 Performance

- Event listeners use WebSocket connections for real-time updates
- Database queries are optimized with proper indexing
- Alert system includes rate limiting and deduplication

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.
