const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const TwitterService = require('./twitterService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));
app.use(express.json());
app.use(express.static('public'));

// Data file path
const DATA_FILE = path.join(__dirname, '../data/posts.json');

/**
 * Fetch and update tweets data
 */
async function updateTweetsData() {
  try {
    console.log('🔄 Updating tweets data...');
    
    const twitterService = new TwitterService();
    const tweetsData = await twitterService.fetchRecentTweets();
    const processedData = twitterService.processTweets(tweetsData);
    
    // Ensure data directory exists
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Save data
    const dataToSave = {
      lastUpdated: new Date().toISOString(),
      totalPosts: processedData.withCoords.length + processedData.missingCoords.length,
      postsWithCoords: processedData.withCoords.length,
      postsMissingCoords: processedData.missingCoords.length,
      posts: processedData
    };
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));
    console.log('✅ Tweets data updated successfully');
    
    return dataToSave;
  } catch (error) {
    console.error('❌ Error updating tweets:', error.message);
    throw error;
  }
}

/**
 * Read posts data from file
 */
function readPostsData() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      lastUpdated: null,
      totalPosts: 0,
      postsWithCoords: 0,
      postsMissingCoords: 0,
      posts: { withCoords: [], missingCoords: [] }
    };
  }
  
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(data);
}

// API Routes

/**
 * GET /api/locations
 * Returns all posts with coordinates for map display
 */
app.get('/api/locations', (req, res) => {
  try {
    const data = readPostsData();
    res.json({
      lastUpdated: data.lastUpdated,
      count: data.postsWithCoords,
      locations: data.posts.withCoords
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
app.get('/api/posts', (req, res) => {
  try {
    const data = readPostsData();
    res.json({
      lastUpdated: data.lastUpdated,
      totalPosts: data.totalPosts,
      postsWithCoords: data.postsWithCoords,
      postsMissingCoords: data.postsMissingCoords,
      posts: data.posts
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
    const data = await updateTweetsData();
    res.json({
      success: true,
      message: 'Data refreshed successfully',
      data: {
        lastUpdated: data.lastUpdated,
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
app.get('/api/status', (req, res) => {
  const data = readPostsData();
  res.json({
    status: 'online',
    lastUpdated: data.lastUpdated,
    totalPosts: data.totalPosts,
    postsWithCoords: data.postsWithCoords,
    postsMissingCoords: data.postsMissingCoords
  });
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

// Initialize: Fetch data on startup if file doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  console.log('📥 No data file found. Fetching initial data...');
  updateTweetsData().catch(err => {
    console.error('Failed to fetch initial data:', err.message);
    console.log('Server will start anyway. Use POST /api/refresh to try again.');
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 Map view: http://localhost:${PORT}`);
  console.log(`📋 Posts list: http://localhost:${PORT}/posts.html`);
  console.log(`🔄 Next automatic update: every 2 days at 2 AM`);
});
