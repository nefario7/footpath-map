const TwitterService = require('../src/twitterService');
const db = require('../src/db');
const { getAllPosts, savePosts } = require('../src/db');
require('dotenv').config();

/**
 * Reprocess existing tweet data with updated parsing logic
 * Reads from DB, re-parses text, and updates DB
 */
async function reprocessExistingData() {
  try {
    await db.initDB();
    console.log('📂 Reading existing data from database...');

    const dbData = await getAllPosts();
    const allTweets = [
      ...dbData.posts.withCoords,
      ...dbData.posts.missingCoords
    ];

    if (allTweets.length === 0) {
      console.log('⚠️ No tweets found in database.');
      process.exit(0);
    }

    console.log(`📊 Found ${allTweets.length} total tweets to reprocess`);
    console.log(`   Current: ${dbData.postsWithCoords} with coords, ${dbData.postsMissingCoords} without`);

    // Reprocess with new parsing logic
    console.log('🔄 Re-parsing coordinates...');
    const twitterService = new TwitterService();
    const withCoords = [];
    const missingCoords = [];

    for (const tweet of allTweets) {
      // Re-run parseCoordinates on the text
      const coords = twitterService.parseCoordinates(tweet.text);

      const processedTweet = {
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.createdAt,
        url: tweet.url,
        mediaUrls: tweet.mediaUrls || [],
        extractedLocation: tweet.extractedLocation // Preserve existing extraction
      };

      if (coords) {
        // If we found coords (maybe new regex pattern?), update it
        // Note: This might overwrite existing 'geocoded' source with 'regex' 
        // but usually regex is more accurate if present.
        withCoords.push({
          ...processedTweet,
          coordinates: { ...coords, source: 'regex' }
        });
      } else {
        // Preserve existing coordinates if they were geocoded and we didn't find new regex ones
        if (tweet.coordinates && tweet.coordinates.source === 'geocoded') {
          withCoords.push({
            ...processedTweet,
            coordinates: tweet.coordinates
          });
        } else {
          missingCoords.push(processedTweet);
        }
      }
    }

    console.log(`\n✅ Reprocessing complete!`);
    console.log(`   New State: ${withCoords.length} with coords, ${missingCoords.length} without`);

    // Save updated data
    const allProcessed = [...withCoords, ...missingCoords];
    const savedCount = await savePosts(allProcessed);

    console.log(`✅ Updated ${savedCount} posts in database`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error reprocessing data:', error);
    process.exit(1);
  }
}

reprocessExistingData();
