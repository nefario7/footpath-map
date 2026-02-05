const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const TwitterService = require('./twitterService');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use(express.static('public')); // Fallback for old assets if any


/**
 * Fetch and update tweets data
 */
async function updateTweetsData() {
  try {
    console.log('🔄 Updating tweets data...');

    // Initialize DB if needed (failsafe)
    await db.initDB();

    const twitterService = new TwitterService();

    // Get latest ID to fetch only new tweets
    const sinceId = await db.getLatestTweetId();
    console.log(`   Latest tweet ID in DB: ${sinceId || 'None (Initial fetch)'}`);

    const tweetsData = await twitterService.fetchRecentTweets(sinceId);

    if (tweetsData.tweets.length === 0) {
      console.log('No new tweets to process.');
      return await db.getAllPosts();
    }

    const processedData = await twitterService.processTweets(tweetsData);

    // Save to DB
    const allPosts = [...processedData.withCoords, ...processedData.missingCoords];
    const savedCount = await db.savePosts(allPosts);

    console.log(`✅ Saved ${savedCount} new/updated posts to database`);

    return await db.getAllPosts();
  } catch (error) {
    console.error('❌ Error updating tweets:', error.message);
    throw error;
  }
}

// API Routes

/**
 * GET /api/locations
 * Returns all posts with coordinates for map display
 */
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await db.getLocations();
    res.json({
      lastUpdated: new Date(), // Real-time
      count: locations.length,
      locations: locations
    });
  } catch (error) {
    console.error('Error reading locations:', error);
    res.status(500).json({ error: 'Failed to read locations data' });
  }
});

/**
 * GET /api/posts
 * Returns all posts (with and without coordinates)
 */
app.get('/api/posts', async (req, res) => {
  try {
    const data = await db.getAllPosts();
    res.json({
      lastUpdated: new Date(),
      ...data
    });
  } catch (error) {
    console.error('Error reading posts:', error);
    res.status(500).json({ error: 'Failed to read posts data' });
  }
});

/**
 * POST /api/refresh
 * Manually trigger data refresh
 */
app.post('/api/refresh', async (req, res) => {
  try {
    await updateTweetsData();
    const data = await db.getAllPosts();

    res.json({
      success: true,
      message: 'Data refreshed successfully',
      data: {
        lastUpdated: new Date(),
        totalPosts: data.totalPosts,
        postsWithCoords: data.postsWithCoords,
        postsMissingCoords: data.postsMissingCoords
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to refresh data',
      message: error.message
    });
  }
});

/**
 * GET /api/status
 * Returns server status and last update time
 */
app.get('/api/status', async (req, res) => {
  try {
    const data = await db.getAllPosts();
    res.json({
      status: 'online',
      lastUpdated: new Date(),
      totalPosts: data.totalPosts,
      postsWithCoords: data.postsWithCoords,
      postsMissingCoords: data.postsMissingCoords
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Schedule automatic updates every 2 days at 2 AM
cron.schedule('0 2 */2 * *', async () => {
  console.log('⏰ Scheduled tweet fetch started');
  try {
    await updateTweetsData();
  } catch (error) {
    console.error('Scheduled update failed:', error);
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start server
const startServer = async () => {
  try {
    // Initialize DB connection
    await db.initDB();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📍 Map view: http://localhost:${PORT}`);
      console.log(`📋 Posts list: http://localhost:${PORT}/posts.html`);
    });
  } catch (error) {
    console.error('Fatal error starting server:', error);
  }
};

startServer();
