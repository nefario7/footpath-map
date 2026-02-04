# Bangalore Footpath Issues Map

A web dashboard that visualizes bad footpath locations in Bangalore based on Twitter posts from [@caleb_friesen](https://x.com/caleb_friesen).

## Features

- 🗺️ Interactive map showing footpath issue locations
- 📱 Posts list with tweet text and images
- 🔄 Automatic updates every 2 days
- ⚠️ Highlights posts missing coordinate information

## Setup

### Prerequisites

- Node.js 18+ installed
- Twitter Developer Account with Bearer Token

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Add your Twitter Bearer Token to `.env`:
   ```
   TWITTER_BEARER_TOKEN=your_actual_bearer_token
   ```

### Running Locally

Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

Visit `http://localhost:3000` to view the dashboard.

### Manual Data Fetch

To manually fetch tweets:
```bash
npm run fetch
```

## Deployment

- **Backend**: Deploy to [Render.com](https://render.com)
- **Frontend**: Deploy to [Netlify](https://netlify.com)

## Tech Stack

- **Backend**: Node.js, Express, twitter-api-v2
- **Frontend**: HTML, CSS, JavaScript, Leaflet.js (OpenStreetMap)
- **Data**: JSON file storage

## License

MIT
