# Cross-Chain Bridge Monitoring System

A real-time monitoring and alerting system for cross-chain bridge transactions. Built to detect anomalies, track transaction flows, and provide comprehensive insights across multiple blockchain networks.

## Overview

This system monitors bridge transactions across Ethereum, Polygon, and BSC networks, providing real-time anomaly detection, automated alerting, and a comprehensive dashboard for transaction analysis.

## Features

- **Real-time Event Monitoring**: Track bridge events across multiple blockchain networks
- **Anomaly Detection**: Detect timeouts, value mismatches, duplicate transactions, and suspicious activity
- **Real-time Alerts**: Instant notifications via web UI, Discord, Slack, and email
- **Interactive Dashboard**: Visualize bridge flows, volume trends, and system health
- **Historical Analysis**: Query and analyze past bridge transactions
- **RESTful API**: Comprehensive API for integration with external systems

## Architecture

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

## Quick Start

### Prerequisites

- Node.js 16+
- MongoDB 4.4+
- Blockchain RPC endpoints (Infura, Alchemy, etc.)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the application:
   ```bash
   npm start
   ```

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Environment Variables
Set these in your deployment platform:
- `MONGODB_URI` - MongoDB connection string
- `ETHEREUM_RPC_URL` - Ethereum RPC endpoint
- `POLYGON_RPC_URL` - Polygon RPC endpoint
- `BSC_RPC_URL` - BSC RPC endpoint
- `API_KEYS` - API authentication keys
- `JWT_SECRET` - JWT secret key

## API Endpoints

- `GET /api/transactions` - List bridge transactions
- `GET /api/anomalies` - List detected anomalies
- `GET /api/alerts` - List system alerts
- `GET /api/volume` - Get volume statistics
- `GET /api/health` - System health check

## Configuration

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

We welcome contributions from the community! Here's how you can help improve the Cross-Chain Bridge Monitoring System:

### 🚀 Getting Started

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub or use GitHub CLI
   gh repo fork Subaskar-S/cross-chain-bridge-monitoring
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/cross-chain-bridge-monitoring.git
   cd cross-chain-bridge-monitoring
   ```

3. **Set up the upstream remote**
   ```bash
   git remote add upstream https://github.com/Subaskar-S/cross-chain-bridge-monitoring.git
   ```

### 🔧 Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or for bug fixes
   git checkout -b fix/issue-description
   ```

2. **Make your changes**
   - Follow the existing code style and conventions
   - Add tests for new functionality
   - Update documentation as needed
   - Ensure all tests pass: `npm test`

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add feature: brief description of what you added"
   ```

   **Commit Message Guidelines:**
   - Use present tense ("Add feature" not "Added feature")
   - Keep the first line under 50 characters
   - Reference issues when applicable: "Fix #123: resolve connection timeout"

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**
   - Go to your fork on GitHub
   - Click "New Pull Request"
   - Provide a clear title and description
   - Link any related issues

### 📋 Contribution Guidelines

- **Code Quality**: Follow ESLint and Prettier configurations
- **Testing**: Add unit tests for new features
- **Documentation**: Update README and inline comments
- **Security**: Never commit sensitive data or API keys
- **Performance**: Consider performance implications of your changes

### 🐛 Reporting Issues

Found a bug? Please create an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node.js version, etc.)

### 💡 Feature Requests

Have an idea? Open an issue with:
- Clear description of the feature
- Use case and benefits
- Possible implementation approach

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Subaskar_S**

- GitHub: [@Subaskar-S](https://github.com/Subaskar-S)
- LinkedIn: [subaskar97](https://www.linkedin.com/in/subaskar97)
