const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

class TwitterService {
  constructor() {
    this.client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
  }

  /**
   * Fetch tweets from @caleb_friesen for the last 60 days
   */
  async fetchRecentTweets() {
    try {
      const username = 'caleb_friesen';
      
      // Get user ID first
      const user = await this.client.v2.userByUsername(username);
      if (!user.data) {
        throw new Error(`User @${username} not found`);
      }

      const userId = user.data.id;
      
      // Calculate date 60 days ago
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const startTime = sixtyDaysAgo.toISOString();

      // Fetch tweets with media information
      const tweets = await this.client.v2.userTimeline(userId, {
        max_results: 100,
        start_time: startTime,
        'tweet.fields': ['created_at', 'text', 'attachments'],
        'media.fields': ['url', 'preview_image_url', 'type'],
        expansions: ['attachments.media_keys']
      });

      const allTweets = [];
      for await (const tweet of tweets) {
        allTweets.push(tweet);
      }

      console.log(`Fetched ${allTweets.length} tweets from @${username}`);
      
      return {
        tweets: allTweets,
        includes: tweets.includes
      };
    } catch (error) {
      console.error('Error fetching tweets:', error);
      throw error;
    }
  }

  /**
   * Parse coordinates from tweet text
   * Format: "Coords: 12.944583, 77.620572"
   */
  parseCoordinates(text) {
    const coordRegex = /Coords?:\s*([\d.]+),\s*([\d.]+)/i;
    const match = text.match(coordRegex);
    
    if (match) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      
      // Validate coordinates are within Bangalore bounds (approximately)
      // Bangalore: lat 12.8-13.2, lon 77.4-77.8
      if (lat >= 12.7 && lat <= 13.3 && lon >= 77.3 && lon <= 77.9) {
        return { lat, lon };
      }
    }
    
    return null;
  }

  /**
   * Get media URLs from tweet
   */
  getMediaUrls(tweet, includes) {
    if (!tweet.attachments || !tweet.attachments.media_keys || !includes || !includes.media) {
      return [];
    }

    const mediaUrls = [];
    for (const mediaKey of tweet.attachments.media_keys) {
      const media = includes.media.find(m => m.media_key === mediaKey);
      if (media) {
        if (media.type === 'photo' && media.url) {
          mediaUrls.push(media.url);
        } else if (media.type === 'video' && media.preview_image_url) {
          mediaUrls.push(media.preview_image_url);
        }
      }
    }

    return mediaUrls;
  }

  /**
   * Process tweets and categorize by coordinate availability
   */
  processTweets(tweetsData) {
    const { tweets, includes } = tweetsData;
    const withCoords = [];
    const missingCoords = [];

    for (const tweet of tweets) {
      const coords = this.parseCoordinates(tweet.text);
      const mediaUrls = this.getMediaUrls(tweet, includes);
      
      const processedTweet = {
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.created_at,
        url: `https://twitter.com/caleb_friesen/status/${tweet.id}`,
        mediaUrls: mediaUrls
      };

      if (coords) {
        withCoords.push({
          ...processedTweet,
          coordinates: coords
        });
      } else {
        missingCoords.push(processedTweet);
      }
    }

    console.log(`Processed: ${withCoords.length} with coords, ${missingCoords.length} without coords`);

    return { withCoords, missingCoords };
  }
}

module.exports = TwitterService;
