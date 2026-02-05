const TwitterService = require('../src/twitterService');
const db = require('../src/db');
require('dotenv').config();

async function fetchTweets() {
  try {
    console.log('🚀 Starting manual tweet fetch...');

    // Connect to DB
    await db.initDB();

    // Get latest ID
    const sinceId = await db.getLatestTweetId();
    if (sinceId) {
      console.log(`📡 Fetching tweets newer than ID: ${sinceId}`);
    } else {
      console.log('📡 Fetching initial batch of tweets (last 60 days)...');
    }

    const twitterService = new TwitterService();
    const tweetsData = await twitterService.fetchRecentTweets(sinceId);

    if (tweetsData.tweets.length === 0) {
      console.log('✅ No new tweets found.');
      process.exit(0);
    }

    console.log(`Processing ${tweetsData.tweets.length} tweets...`);
    const processedData = await twitterService.processTweets(tweetsData);

    const allPosts = [...processedData.withCoords, ...processedData.missingCoords];
    const savedCount = await db.savePosts(allPosts);

    console.log(`✅ Saved ${savedCount} new posts to database!`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fetching tweets:', error);
    process.exit(1);
  }
}

fetchTweets();
