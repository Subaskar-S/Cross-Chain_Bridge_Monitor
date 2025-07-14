# Bridge Monitor Dashboard

A React-based dashboard for monitoring cross-chain bridge transactions, anomalies, and alerts in real-time.

## Features

- **Real-time Updates**: Live data updates via Socket.io
- **Transaction Monitoring**: View and filter bridge transactions across multiple chains
- **Anomaly Detection**: Monitor detected anomalies with severity levels
- **Alert Management**: Real-time alerts and notifications
- **Network Status**: Monitor the health of different blockchain networks
- **Interactive Charts**: Volume and transaction trend visualization
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Chart.js** with react-chartjs-2 for data visualization
- **Socket.io Client** for real-time updates
- **Axios** for API communication
- **React Router** for navigation

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- The main bridge monitoring server running on port 3000

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment configuration:
```bash
cp .env.example .env
```

3. Update environment variables in `.env`:
```env
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_SERVER_URL=http://localhost:3000
REACT_APP_API_KEY=your-api-key
```

### Development

Start the development server:
```bash
npm start
```

The dashboard will be available at `http://localhost:3001`

### Production Build

Build for production:
```bash
npm run build
```

The built files will be in the `build/` directory and can be served by the main server.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Dashboard/      # Dashboard-specific components
│   ├── Layout/         # Layout components (Header, Sidebar)
│   └── Notifications/  # Notification components
├── contexts/           # React contexts for state management
│   ├── ApiContext.tsx  # API client context
│   ├── SocketContext.tsx # Socket.io context
│   └── NotificationContext.tsx # Notification system
├── pages/              # Page components
│   ├── Dashboard.tsx   # Main dashboard page
│   ├── Transactions.tsx # Transaction list page
│   ├── Anomalies.tsx   # Anomaly management page
│   ├── Alerts.tsx      # Alert management page
│   └── Settings.tsx    # Settings page
├── App.tsx             # Main app component
├── index.tsx           # App entry point
└── index.css           # Global styles
```

## Key Components

### Dashboard
- **StatsCard**: Display key metrics with trend indicators
- **VolumeChart**: Interactive chart showing volume and transaction trends
- **NetworkStatus**: Real-time status of blockchain networks
- **RecentTransactions**: List of recent bridge transactions
- **RecentAlerts**: Latest system alerts
- **SystemHealth**: System component health monitoring

### Real-time Features
- **Socket.io Integration**: Automatic updates for new transactions, alerts, and anomalies
- **Live Notifications**: Toast notifications for critical events
- **Connection Status**: Visual indicator of server connection status

### API Integration
- **RESTful API**: Full integration with the bridge monitoring API
- **Error Handling**: Comprehensive error handling and user feedback
- **Rate Limiting**: Respects API rate limits with proper error messages

## Configuration

### Environment Variables

- `REACT_APP_API_URL`: Base URL for the API (default: http://localhost:3000/api)
- `REACT_APP_SERVER_URL`: WebSocket server URL (default: http://localhost:3000)
- `REACT_APP_API_KEY`: API key for authenticated requests
- `REACT_APP_ENV`: Environment (development/production)

### Customization

The dashboard uses Tailwind CSS for styling. You can customize:

1. **Colors**: Update the color palette in `tailwind.config.js`
2. **Components**: Modify component styles in individual component files
3. **Layout**: Adjust the layout in `src/components/Layout/`

## API Endpoints Used

The dashboard integrates with these API endpoints:

- `GET /api/volume/dashboard` - Dashboard statistics
- `GET /api/volume/trends` - Volume trend data
- `GET /api/transactions` - Transaction list with filters
- `GET /api/alerts/recent` - Recent alerts
- `GET /api/anomalies` - Anomaly data
- `WebSocket events` - Real-time updates

## Development Notes

### State Management
- Uses React Context for global state (API, Socket, Notifications)
- Local component state for UI-specific data
- Real-time updates via Socket.io events

### Performance
- Lazy loading for large data sets
- Efficient re-rendering with proper dependency arrays
- Debounced API calls for search and filters

### Error Handling
- Global error boundaries for React errors
- API error handling with user-friendly messages
- Connection status monitoring and recovery

## Troubleshooting

### Common Issues

1. **Dashboard not loading**: Check if the main server is running on port 3000
2. **API errors**: Verify the API key and server URL in `.env`
3. **Real-time updates not working**: Check WebSocket connection status
4. **Build errors**: Ensure all dependencies are installed with `npm install`

### Debug Mode

Enable debug logging by setting:
```env
REACT_APP_ENV=development
```

This will show additional console logs for API calls and Socket.io events.

## Contributing

1. Follow the existing code structure and naming conventions
2. Add TypeScript types for new components and data structures
3. Include error handling for new API integrations
4. Test real-time features with the Socket.io connection
5. Ensure responsive design for mobile devices

## License

This project is part of the Cross-Chain Bridge Monitoring System.
